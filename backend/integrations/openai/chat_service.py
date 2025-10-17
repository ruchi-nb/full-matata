"""
OpenAI Chat Service - Production Grade
Handles chat completion functionality with streaming, connection pooling, and optimized performance
OpenAI Chat Service - Production Grade
Handles chat completion functionality with streaming, connection pooling, and optimized performance
"""

import logging
import time
import asyncio
from typing import Optional, Generator, Dict
import asyncio
from typing import Optional, Generator, Dict
from config import settings

try:
    from openai import OpenAI, AsyncOpenAI
    from openai import OpenAI, AsyncOpenAI
except Exception:  # pragma: no cover
    OpenAI = None
    AsyncOpenAI = None
    OpenAI = None
    AsyncOpenAI = None

try:
    from integrations.rag.service import RAGService
except Exception:
    RAGService = None
    RAGService = None

logger = logging.getLogger(__name__)


class OpenAIChatService:
    """Production-grade OpenAI chat service with connection pooling and caching"""
    
    """Production-grade OpenAI chat service with connection pooling and caching"""
    
    def __init__(self) -> None:
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL
        self.base_url = settings.OPENAI_BASE_URL
        self.last_usage = {}
        
        
        if OpenAI is None:
            raise RuntimeError("openai package not available")
        
        # Ultra-optimized clients with minimal overhead
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=10.0,  # Reduced timeout for faster failure detection
            max_retries=1,  # Minimal retries for speed
            http_client=None  # Use default HTTP client with connection pooling
        )
        
        # Async client for better performance with optimized settings
        self.async_client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=10.0,
            max_retries=1,
            http_client=None
        ) if AsyncOpenAI else None
        
        # RAG service with caching
        
        # Ultra-optimized clients with minimal overhead
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=10.0,  # Reduced timeout for faster failure detection
            max_retries=1,  # Minimal retries for speed
            http_client=None  # Use default HTTP client with connection pooling
        )
        
        # Async client for better performance with optimized settings
        self.async_client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=10.0,
            max_retries=1,
            http_client=None
        ) if AsyncOpenAI else None
        
        # RAG service with caching
        self.rag_service = RAGService() if RAGService else None

        # Ultra-optimized response cache for better performance
        self._response_cache: Dict[str, tuple] = {}  # {prompt_hash: (response, timestamp)}
        self._cache_ttl = 600  # 10 minutes TTL for responses (increased for better hit rate)
        self._max_cache_size = 300  # Larger cache size for better performance
        
        logger.info("OpenAI Chat Service initialized with connection pooling")

    def _get_cache_key(self, prompt: str, system_prompt: str) -> str:
        """Ultra-fast cache key generation"""
        return f"{hash(prompt)}_{len(system_prompt)}"
    
    def _get_cached_response(self, prompt: str, system_prompt: str) -> Optional[str]:
        """Get cached response if available and not expired"""
        cache_key = self._get_cache_key(prompt, system_prompt)
        if cache_key in self._response_cache:
            response, timestamp = self._response_cache[cache_key]
            if time.time() - timestamp < self._cache_ttl:
                logger.info(f"Response Cache HIT (saved OpenAI call)")
                return response
            else:
                del self._response_cache[cache_key]
        return None
    
    def _cache_response(self, prompt: str, system_prompt: str, response: str):
        """Cache response for future use"""
        cache_key = self._get_cache_key(prompt, system_prompt)
        
        # Limit cache size
        if len(self._response_cache) >= self._max_cache_size:
            oldest_key = min(self._response_cache.keys(), 
                           key=lambda k: self._response_cache[k][1])
            del self._response_cache[oldest_key]
        
        self._response_cache[cache_key] = (response, time.time())

    def _stream_completion(
        self, 
        messages, 
        max_tokens, 
        temperature, 
        top_p, 
        start_time
    ) -> Generator[str, None, None]:
        """
        Stream tokens as they arrive from OpenAI with retry logic and error handling
        """
        retry_count = 0
        max_retries = 2
        
        while retry_count <= max_retries:
            try:
                # Print complete request to console for debugging (first attempt only)
                if retry_count == 0:
                    print("\n" + "="*80)
                    print(" OPENAI API REQUEST")
                    print("="*80)
                    print(f"Model: {self.model}")
                    print(f"Parameters: max_tokens={max_tokens}, temperature={temperature}, top_p={top_p}, stream=True")
                    print(f"\nMessages ({len(messages)} total):")
                    print("-"*80)
                    
                    for i, msg in enumerate(messages):
                        role = msg.get('role', 'unknown')
                        content = msg.get('content', '')
                        print(f"\n[Message {i}] Role: {role.upper()}")
                        print(f"Content ({len(content)} chars):")
                        # Print preview for long content
                        preview_len = 500
                        if len(content) > preview_len:
                            print(content[:preview_len] + f"... ({len(content) - preview_len} more chars)")
                        else:
                            print(content)
                        print("-"*80)
                    
                    print("="*80 + "\n")
                
                # Log summary
                logger.info(f" OPENAI REQUEST - Model: {self.model}, Messages: {len(messages)}, Total chars: {sum(len(m.get('content', '')) for m in messages)}, Attempt: {retry_count + 1}")
                
                stream = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    stream=True
                )
                
                full_text = ""
                first_token_time = None
                token_count = 0
                
                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        full_text += token
                        token_count += 1
                        
                        if first_token_time is None:
                            first_token_time = time.time()
                            ttft_ms = int((first_token_time - start_time) * 1000)
                            logger.info(f" OpenAI TTFT: {ttft_ms}ms")
                        
                        yield token
                
                # Log completion metrics
                total_time = time.time() - start_time
                logger.info(f" OpenAI Streaming Complete - Tokens: ~{token_count}, Total: {int(total_time*1000)}ms")
                
                # Store for analytics
                self.last_usage = {
                    'total_tokens': token_count,
                    'output_tokens': token_count,
                    'input_tokens': 0  # Not available in streaming
                }
                
                break  # Success, exit retry loop
                
            except Exception as e:
                if retry_count < max_retries:
                    retry_count += 1
                    wait_time = 0.5 * retry_count  # Exponential backoff
                    logger.warning(f" OpenAI streaming error, retrying in {wait_time}s (attempt {retry_count + 1}/{max_retries + 1}): {e}")
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f" OpenAI streaming error after {max_retries} retries: {e}", exc_info=True)
                    yield "I'm sorry, I couldn't generate a response right now."
                    break

    def generate_response(
        self, 
        prompt: str, 
        max_tokens: int = None, 
        temperature: float = None, 
        top_p: float = None, 
        request_id: str = None, 
        session_id: str = None, 
        use_rag: bool = True,
        user_language: Optional[str] = None, 
        system_prompt: Optional[str] = None,
        use_cache: bool = False
    ) -> str:
        """
        Generate response using streaming (collects all tokens and returns full response)
        This is the non-streaming API that internally uses streaming for better performance
        
        Args:
            prompt: User prompt
            use_cache: Enable response caching (default: False for fresh responses)
        """
        # Ultra-optimized response cache for better performance
        self._response_cache: Dict[str, tuple] = {}  # {prompt_hash: (response, timestamp)}
        self._cache_ttl = 600  # 10 minutes TTL for responses (increased for better hit rate)
        self._max_cache_size = 300  # Larger cache size for better performance
        
        logger.info("OpenAI Chat Service initialized with connection pooling")

    def _get_cache_key(self, prompt: str, system_prompt: str) -> str:
        """Ultra-fast cache key generation"""
        return f"{hash(prompt)}_{len(system_prompt)}"
    
    def _get_cached_response(self, prompt: str, system_prompt: str) -> Optional[str]:
        """Get cached response if available and not expired"""
        cache_key = self._get_cache_key(prompt, system_prompt)
        if cache_key in self._response_cache:
            response, timestamp = self._response_cache[cache_key]
            if time.time() - timestamp < self._cache_ttl:
                logger.info(f"Response Cache HIT (saved OpenAI call)")
                return response
            else:
                del self._response_cache[cache_key]
        return None
    
    def _cache_response(self, prompt: str, system_prompt: str, response: str):
        """Cache response for future use"""
        cache_key = self._get_cache_key(prompt, system_prompt)
        
        # Limit cache size
        if len(self._response_cache) >= self._max_cache_size:
            oldest_key = min(self._response_cache.keys(), 
                           key=lambda k: self._response_cache[k][1])
            del self._response_cache[oldest_key]
        
        self._response_cache[cache_key] = (response, time.time())

    def _stream_completion(
        self, 
        messages, 
        max_tokens, 
        temperature, 
        top_p, 
        start_time
    ) -> Generator[str, None, None]:
        """
        Stream tokens as they arrive from OpenAI with retry logic and error handling
        """
        retry_count = 0
        max_retries = 2
        
        while retry_count <= max_retries:
            try:
                # Print complete request to console for debugging (first attempt only)
                if retry_count == 0:
                    print("\n" + "="*80)
                    print(" OPENAI API REQUEST")
                    print("="*80)
                    print(f"Model: {self.model}")
                    print(f"Parameters: max_tokens={max_tokens}, temperature={temperature}, top_p={top_p}, stream=True")
                    print(f"\nMessages ({len(messages)} total):")
                    print("-"*80)
                    
                    for i, msg in enumerate(messages):
                        role = msg.get('role', 'unknown')
                        content = msg.get('content', '')
                        print(f"\n[Message {i}] Role: {role.upper()}")
                        print(f"Content ({len(content)} chars):")
                        # Print preview for long content
                        preview_len = 500
                        if len(content) > preview_len:
                            print(content[:preview_len] + f"... ({len(content) - preview_len} more chars)")
                        else:
                            print(content)
                        print("-"*80)
                    
                    print("="*80 + "\n")
                
                # Log summary
                logger.info(f" OPENAI REQUEST - Model: {self.model}, Messages: {len(messages)}, Total chars: {sum(len(m.get('content', '')) for m in messages)}, Attempt: {retry_count + 1}")
                
                stream = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    stream=True
                )
                
                full_text = ""
                first_token_time = None
                token_count = 0
                
                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        full_text += token
                        token_count += 1
                        
                        if first_token_time is None:
                            first_token_time = time.time()
                            ttft_ms = int((first_token_time - start_time) * 1000)
                            logger.info(f" OpenAI TTFT: {ttft_ms}ms")
                        
                        yield token
                
                # Log completion metrics
                total_time = time.time() - start_time
                logger.info(f" OpenAI Streaming Complete - Tokens: ~{token_count}, Total: {int(total_time*1000)}ms")
                
                # Store for analytics
                self.last_usage = {
                    'total_tokens': token_count,
                    'output_tokens': token_count,
                    'input_tokens': 0  # Not available in streaming
                }
                
                break  # Success, exit retry loop
                
            except Exception as e:
                if retry_count < max_retries:
                    retry_count += 1
                    wait_time = 0.5 * retry_count  # Exponential backoff
                    logger.warning(f" OpenAI streaming error, retrying in {wait_time}s (attempt {retry_count + 1}/{max_retries + 1}): {e}")
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f" OpenAI streaming error after {max_retries} retries: {e}", exc_info=True)
                    yield "I'm sorry, I couldn't generate a response right now."
                    break

    def generate_response(
        self, 
        prompt: str, 
        max_tokens: int = None, 
        temperature: float = None, 
        top_p: float = None, 
        request_id: str = None, 
        session_id: str = None, 
        use_rag: bool = True,
        user_language: Optional[str] = None, 
        system_prompt: Optional[str] = None,
        use_cache: bool = False
    ) -> str:
        """
        Generate response using streaming (collects all tokens and returns full response)
        This is the non-streaming API that internally uses streaming for better performance
        
        Args:
            prompt: User prompt
            use_cache: Enable response caching (default: False for fresh responses)
        """
        from system_prompt import VIRTUAL_DOCTOR_SYSTEM_PROMPT
        from database.redis import SessionManager
        
        try:
            max_tokens = max_tokens or settings.OPENAI_MAX_TOKENS
            temperature = temperature or settings.OPENAI_TEMPERATURE
            top_p = top_p or settings.OPENAI_TOP_P
            
            base_system_prompt = system_prompt or VIRTUAL_DOCTOR_SYSTEM_PROMPT
            
            # Check cache for non-session, non-RAG requests
            if use_cache and not session_id and not use_rag:
                cached = self._get_cached_response(prompt, base_system_prompt)
                if cached:
                    return cached
            
            base_system_prompt = system_prompt or VIRTUAL_DOCTOR_SYSTEM_PROMPT
            
            # Check cache for non-session, non-RAG requests
            if use_cache and not session_id and not use_rag:
                cached = self._get_cached_response(prompt, base_system_prompt)
                if cached:
                    return cached
            
            # Build RAG context if available and enabled
            rag_context = ""
            if use_rag and self.rag_service:
                try:
                    rag_context = self.rag_service.build_context(prompt)
                    if rag_context:
                        logger.info(f" RAG context: {len(rag_context)} chars")
                        logger.info(f" RAG context: {len(rag_context)} chars")
                except Exception as e:
                    logger.warning(f" RAG retrieval failed: {e}")
                    logger.warning(f" RAG retrieval failed: {e}")
            
            # Enhance user prompt with RAG context if available
            enhanced_prompt = prompt
            # Enhance user prompt with RAG context if available
            enhanced_prompt = prompt
            if rag_context:
                enhanced_prompt = f"Relevant medical book context:\n{rag_context}\n\nPatient question: {prompt}"
                enhanced_prompt = f"Relevant medical book context:\n{rag_context}\n\nPatient question: {prompt}"
            
            if session_id:
                session_manager = SessionManager()
                session_manager._add_message_to_session(session_id, "user", enhanced_prompt)
                messages = session_manager.get_session_messages(session_id, base_system_prompt)
                
                # Stream and collect full response
                full_response = ""
                for token in self._stream_completion(messages, max_tokens, temperature, top_p, time.time()):
                    full_response += token
                
                session_manager._add_message_to_session(session_id, "assistant", full_response)
                return full_response
                session_manager._add_message_to_session(session_id, "user", enhanced_prompt)
                messages = session_manager.get_session_messages(session_id, base_system_prompt)
                
                # Stream and collect full response
                full_response = ""
                for token in self._stream_completion(messages, max_tokens, temperature, top_p, time.time()):
                    full_response += token
                
                session_manager._add_message_to_session(session_id, "assistant", full_response)
                return full_response
            else:
                messages = [
                    {"role": "system", "content": base_system_prompt},
                    {"role": "user", "content": enhanced_prompt},
                    {"role": "system", "content": base_system_prompt},
                    {"role": "user", "content": enhanced_prompt}
                ]
                
                # Stream and collect full response
                full_response = ""
                for token in self._stream_completion(messages, max_tokens, temperature, top_p, time.time()):
                    full_response += token
                
                # Cache response if enabled
                if use_cache:
                    self._cache_response(prompt, base_system_prompt, full_response)
                
                return full_response
                
                
                # Stream and collect full response
                full_response = ""
                for token in self._stream_completion(messages, max_tokens, temperature, top_p, time.time()):
                    full_response += token
                
                # Cache response if enabled
                if use_cache:
                    self._cache_response(prompt, base_system_prompt, full_response)
                
                return full_response
                
        except Exception as e:
            logger.error(f" OpenAI completion error: {e}", exc_info=True)
            logger.error(f" OpenAI completion error: {e}", exc_info=True)
            return "I'm sorry, I couldn't generate a response right now."
    
    def generate_response_stream(
        self, 
        prompt: str, 
        max_tokens: int = None, 
        temperature: float = None, 
        top_p: float = None,
        request_id: str = None, 
        session_id: str = None, 
        use_rag: bool = True,
        user_language: Optional[str] = None, 
        system_prompt: Optional[str] = None
    ) -> Generator[str, None, None]:
        """
        Generate response using streaming (yields tokens as they arrive)
        Use this for real-time streaming to the client
        """
        from system_prompt import VIRTUAL_DOCTOR_SYSTEM_PROMPT
        from database.redis import SessionManager
        
        try:
            max_tokens = max_tokens or settings.OPENAI_MAX_TOKENS
            temperature = temperature or settings.OPENAI_TEMPERATURE
            top_p = top_p or settings.OPENAI_TOP_P
            
            base_system_prompt = system_prompt or VIRTUAL_DOCTOR_SYSTEM_PROMPT
            
            # Build RAG context if available and enabled
            rag_context = ""
            if use_rag and self.rag_service:
                try:
                    rag_start = time.time()
                    rag_context = self.rag_service.build_context(prompt)
                    rag_time = int((time.time() - rag_start) * 1000)
                    if rag_context:
                        logger.info(f" RAG context: {len(rag_context)} chars ({rag_time}ms)")
                except Exception as e:
                    logger.warning(f" RAG retrieval failed: {e}")
            
            # Enhance user prompt with RAG context if available
            enhanced_prompt = prompt
            if rag_context:
                enhanced_prompt = f"Relevant medical book context:\n{rag_context}\n\nPatient question: {prompt}"
            
            if session_id:
                session_manager = SessionManager()
                session_manager._add_message_to_session(session_id, "user", enhanced_prompt)
                messages = session_manager.get_session_messages(session_id, base_system_prompt)
                
                # Stream tokens and collect full response
                full_response = ""
                for token in self._stream_completion(messages, max_tokens, temperature, top_p, time.time()):
                    full_response += token
                    yield token
                
                # Save full response to session
                session_manager._add_message_to_session(session_id, "assistant", full_response)
            else:
                messages = [
                    {"role": "system", "content": base_system_prompt},
                    {"role": "user", "content": enhanced_prompt}
                ]
                for token in self._stream_completion(messages, max_tokens, temperature, top_p, time.time()):
                    yield token
                    
        except Exception as e:
            logger.error(f" OpenAI streaming error: {e}", exc_info=True)
            yield "I'm sorry, I couldn't generate a response right now."
    
    # Session Management Methods
    def clear_session(self, session_id: str):
        from database.redis import SessionManager
        return SessionManager().clear_session(session_id)
    
    def clear_all_sessions(self):
        from database.redis import SessionManager
        return SessionManager().clear_all_sessions()
    
    def cleanup_expired_sessions(self):
        from database.redis import SessionManager
        return SessionManager().cleanup_expired_sessions()
    
    def get_session_info(self):
        from database.redis import SessionManager
        return SessionManager().get_session_info()
    
    def get_session_conversation(self, session_id: str):
        from database.redis import SessionManager
        return SessionManager().get_session_conversation(session_id)
    
    def clear_cache(self):
        """Clear response cache"""
        self._response_cache.clear()
        logger.info(" Response cache cleared")
















# """
# Unified Chat Service - Production Grade
# Handles chat completion functionality with streaming, connection pooling, and optimized performance
# Supports both OpenAI and Google Gemini 2.0 Flash
# """

# import logging
# import time
# import asyncio
# from typing import Optional, Generator, Dict
# from config import settings

# try:
#     from openai import OpenAI, AsyncOpenAI
# except Exception:  # pragma: no cover
#     OpenAI = None
#     AsyncOpenAI = None

# try:
#     import google.generativeai as genai
#     from google.generativeai.types import HarmCategory, HarmBlockThreshold
# except Exception:  # pragma: no cover
#     genai = None

# try:
#     from integrations.rag.service import RAGService
# except Exception:
#     RAGService = None

# logger = logging.getLogger(__name__)


# class UnifiedChatService:
#     """Production-grade chat service supporting both OpenAI and Google Gemini 2.0 Flash"""
    
#     def __init__(self) -> None:
#         self.provider = getattr(settings, 'CHAT_PROVIDER', 'openai').lower()  # 'openai' or 'gemini'
#         self.last_usage = {}
        
#         # RAG service with caching
#         self.rag_service = RAGService() if RAGService else None

#         # Response cache for identical prompts (optional)
#         self._response_cache: Dict[str, tuple] = {}  # {prompt_hash: (response, timestamp)}
#         self._cache_ttl = 60  # 1 minute TTL for responses
#         self._max_cache_size = 50  # Limit cache size
        
#         # Initialize provider-specific clients
#         if self.provider == 'openai':
#             self._init_openai()
#         elif self.provider == 'gemini':
#             self._init_gemini()
#         else:
#             raise ValueError(f"Unsupported chat provider: {self.provider}")
        
#         logger.info(f" Unified Chat Service initialized with {self.provider.upper()} provider")

#     def _init_openai(self):
#         """Initialize OpenAI client"""
#         if OpenAI is None:
#             raise RuntimeError("openai package not available")
        
#         self.api_key = settings.OPENAI_API_KEY
#         self.model = settings.OPENAI_MODEL
#         self.base_url = settings.OPENAI_BASE_URL
        
#         # Sync client for backward compatibility
#         self.client = OpenAI(
#             api_key=self.api_key,
#             base_url=self.base_url,
#             timeout=30.0,  # 30s timeout
#             max_retries=2  # Automatic retry on transient failures
#         )
        
#         # Async client for better performance
#         self.async_client = AsyncOpenAI(
#             api_key=self.api_key,
#             base_url=self.base_url,
#             timeout=30.0,
#             max_retries=2
#         ) if AsyncOpenAI else None

#     def _init_gemini(self):
#         """Initialize Gemini client"""
#         if genai is None:
#             raise RuntimeError("google-generativeai package not available")
        
#         self.api_key = getattr(settings, 'GEMINI_API_KEY', None)
#         if not self.api_key:
#             raise ValueError("GEMINI_API_KEY not found in settings")
        
#         self.model = getattr(settings, 'GEMINI_MODEL', 'gemini-2.0-flash-exp')
        
#         # Configure Gemini
#         genai.configure(api_key=self.api_key)
        
#         # Initialize model with safety settings
#         self.model_instance = genai.GenerativeModel(
#             model_name=self.model,
#             safety_settings={
#                 HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
#                 HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
#                 HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
#                 HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
#             }
#         )

#     def _get_cache_key(self, prompt: str, system_prompt: str) -> str:
#         """Generate cache key from prompt and system prompt"""
#         import hashlib
#         combined = f"{system_prompt}:{prompt}:{self.provider}"
#         return hashlib.md5(combined.encode()).hexdigest()
    
#     def _get_cached_response(self, prompt: str, system_prompt: str) -> Optional[str]:
#         """Get cached response if available and not expired"""
#         cache_key = self._get_cache_key(prompt, system_prompt)
#         if cache_key in self._response_cache:
#             response, timestamp = self._response_cache[cache_key]
#             if time.time() - timestamp < self._cache_ttl:
#                 logger.info(f" Response Cache HIT (saved {self.provider.upper()} call)")
#                 return response
#             else:
#                 del self._response_cache[cache_key]
#         return None
    
#     def _cache_response(self, prompt: str, system_prompt: str, response: str):
#         """Cache response for future use"""
#         cache_key = self._get_cache_key(prompt, system_prompt)
        
#         # Limit cache size
#         if len(self._response_cache) >= self._max_cache_size:
#             oldest_key = min(self._response_cache.keys(), 
#                            key=lambda k: self._response_cache[k][1])
#             del self._response_cache[oldest_key]
        
#         self._response_cache[cache_key] = (response, time.time())

#     def _stream_completion_openai(self, messages, max_tokens, temperature, top_p, start_time) -> Generator[str, None, None]:
#         """OpenAI streaming implementation"""
#         retry_count = 0
#         max_retries = 2
        
#         while retry_count <= max_retries:
#             try:
#                 # Print complete request to console for debugging (first attempt only)
#                 if retry_count == 0:
#                     print("\n" + "="*80)
#                     print("OPENAI API REQUEST")
#                     print("="*80)
#                     print(f"Model: {self.model}")
#                     print(f"Parameters: max_tokens={max_tokens}, temperature={temperature}, top_p={top_p}, stream=True")
#                     print(f"\nMessages ({len(messages)} total):")
#                     print("-"*80)
                    
#                     for i, msg in enumerate(messages):
#                         role = msg.get('role', 'unknown')
#                         content = msg.get('content', '')
#                         print(f"\n[Message {i}] Role: {role.upper()}")
#                         print(f"Content ({len(content)} chars):")
#                         # Print preview for long content
#                         preview_len = 500
#                         if len(content) > preview_len:
#                             print(content[:preview_len] + f"... ({len(content) - preview_len} more chars)")
#                         else:
#                             print(content)
#                         print("-"*80)
                    
#                     print("="*80 + "\n")
                
#                 # Log summary
#                 logger.info(f" OPENAI REQUEST - Model: {self.model}, Messages: {len(messages)}, Total chars: {sum(len(m.get('content', '')) for m in messages)}, Attempt: {retry_count + 1}")
                
#                 stream = self.client.chat.completions.create(
#                     model=self.model,
#                     messages=messages,
#                     max_tokens=max_tokens,
#                     temperature=temperature,
#                     top_p=top_p,
#                     stream=True
#                 )
                
#                 full_text = ""
#                 first_token_time = None
#                 token_count = 0
                
#                 for chunk in stream:
#                     if chunk.choices[0].delta.content:
#                         token = chunk.choices[0].delta.content
#                         full_text += token
#                         token_count += 1
                        
#                         if first_token_time is None:
#                             first_token_time = time.time()
#                             ttft_ms = int((first_token_time - start_time) * 1000)
#                             logger.info(f" OpenAI TTFT: {ttft_ms}ms")
                        
#                         yield token
                
#                 # Log completion metrics
#                 total_time = time.time() - start_time
#                 logger.info(f" OpenAI Streaming Complete - Tokens: ~{token_count}, Total: {int(total_time*1000)}ms")
                
#                 # Store for analytics
#                 self.last_usage = {
#                     'total_tokens': token_count,
#                     'output_tokens': token_count,
#                     'input_tokens': 0  # Not available in streaming
#                 }
                
#                 break  # Success, exit retry loop
                
#             except Exception as e:
#                 if retry_count < max_retries:
#                     retry_count += 1
#                     wait_time = 0.5 * retry_count  # Exponential backoff
#                     logger.warning(f" OpenAI streaming error, retrying in {wait_time}s (attempt {retry_count + 1}/{max_retries + 1}): {e}")
#                     time.sleep(wait_time)
#                     continue
#                 else:
#                     logger.error(f" OpenAI streaming error after {max_retries} retries: {e}", exc_info=True)
#                     yield "I'm sorry, I couldn't generate a response right now."
#                     break

#     def _stream_completion_gemini(self, messages, max_tokens, temperature, top_p, start_time) -> Generator[str, None, None]:
#         """Gemini streaming implementation"""
#         try:
#             # Convert OpenAI format to Gemini format
#             conversation_parts = []
#             system_prompt = ""
            
#             for msg in messages:
#                 role = msg.get('role', 'user')
#                 content = msg.get('content', '')
                
#                 if role == 'system':
#                     system_prompt = content
#                 elif role == 'user':
#                     conversation_parts.append({"role": "user", "parts": [content]})
#                 elif role == 'assistant':
#                     conversation_parts.append({"role": "model", "parts": [content]})
            
#             # Print request details for debugging
#             print("\n" + "="*80)
#             print("GEMINI API REQUEST")
#             print("="*80)
#             print(f"Model: {self.model}")
#             print(f"Parameters: max_tokens={max_tokens}, temperature={temperature}, top_p={top_p}")
#             print(f"\nSystem Prompt ({len(system_prompt)} chars):")
#             print("-"*80)
#             print(system_prompt[:500] + ("..." if len(system_prompt) > 500 else ""))
#             print("-"*80)
#             print(f"Conversation Parts: {len(conversation_parts)}")
#             print("="*80 + "\n")
            
#             # Log summary
#             logger.info(f" GEMINI REQUEST - Model: {self.model}, Parts: {len(conversation_parts)}, Total chars: {sum(len(part.get('parts', [''])[0]) for part in conversation_parts)}, Attempt: 1")
            
#             # Start chat session
#             chat = self.model_instance.start_chat(history=conversation_parts[:-1] if len(conversation_parts) > 1 else [])
            
#             # Get the last user message
#             last_message = conversation_parts[-1]['parts'][0] if conversation_parts else ""
            
#             # Generate response with streaming
#             response = chat.send_message(
#                 last_message,
#                 generation_config=genai.types.GenerationConfig(
#                     max_output_tokens=max_tokens,
#                     temperature=temperature,
#                     top_p=top_p,
#                 ),
#                 stream=True
#             )
            
#             full_text = ""
#             first_token_time = None
#             token_count = 0
            
#             for chunk in response:
#                 if chunk.text:
#                     token = chunk.text
#                     full_text += token
#                     token_count += 1
                    
#                     if first_token_time is None:
#                         first_token_time = time.time()
#                         ttft_ms = int((first_token_time - start_time) * 1000)
#                         logger.info(f" Gemini TTFT: {ttft_ms}ms")
                    
#                     yield token
            
#             # Log completion metrics
#             total_time = time.time() - start_time
#             logger.info(f" Gemini Streaming Complete - Tokens: ~{token_count}, Total: {int(total_time*1000)}ms")
            
#             # Store for analytics
#             self.last_usage = {
#                 'total_tokens': token_count,
#                 'output_tokens': token_count,
#                 'input_tokens': 0  # Not available in streaming
#             }
            
#         except Exception as e:
#             logger.error(f" Gemini streaming error: {e}", exc_info=True)
#             yield "I'm sorry, I couldn't generate a response right now."

#     def _stream_completion(self, messages, max_tokens, temperature, top_p, start_time) -> Generator[str, None, None]:
#         """Unified streaming completion"""
#         if self.provider == 'openai':
#             return self._stream_completion_openai(messages, max_tokens, temperature, top_p, start_time)
#         elif self.provider == 'gemini':
#             return self._stream_completion_gemini(messages, max_tokens, temperature, top_p, start_time)
#         else:
#             raise ValueError(f"Unsupported provider: {self.provider}")

#     def generate_response(
#         self, 
#         prompt: str, 
#         max_tokens: int = None, 
#         temperature: float = None, 
#         top_p: float = None, 
#         request_id: str = None, 
#         session_id: str = None, 
#         use_rag: bool = True,
#         user_language: Optional[str] = None, 
#         system_prompt: Optional[str] = None,
#         use_cache: bool = False
#     ) -> str:
#         """
#         Generate response using streaming (collects all tokens and returns full response)
#         This is the non-streaming API that internally uses streaming for better performance
#         """
#         from system_prompt import VIRTUAL_DOCTOR_SYSTEM_PROMPT
#         from database.redis import SessionManager
        
#         try:
#             max_tokens = max_tokens or getattr(settings, 'OPENAI_MAX_TOKENS', 200)
#             temperature = temperature or getattr(settings, 'OPENAI_TEMPERATURE', 0.2)
#             top_p = top_p or getattr(settings, 'OPENAI_TOP_P', 0.9)
            
#             base_system_prompt = system_prompt or VIRTUAL_DOCTOR_SYSTEM_PROMPT
            
#             # Check cache for non-session, non-RAG requests
#             if use_cache and not session_id and not use_rag:
#                 cached = self._get_cached_response(prompt, base_system_prompt)
#                 if cached:
#                     return cached
            
#             # Build RAG context if available and enabled
#             rag_context = ""
#             if use_rag and self.rag_service:
#                 try:
#                     rag_context = self.rag_service.build_context(prompt)
#                     if rag_context:
#                         logger.info(f" RAG context: {len(rag_context)} chars")
#                 except Exception as e:
#                     logger.warning(f" RAG retrieval failed: {e}")
            
#             # Enhance user prompt with RAG context if available
#             enhanced_prompt = prompt
#             if rag_context:
#                 enhanced_prompt = f"Relevant medical book context:\n{rag_context}\n\nPatient question: {prompt}"
            
#             if session_id:
#                 session_manager = SessionManager()
#                 session_manager._add_message_to_session(session_id, "user", enhanced_prompt)
#                 messages = session_manager.get_session_messages(session_id, base_system_prompt)
                
#                 # Stream and collect full response
#                 full_response = ""
#                 for token in self._stream_completion(messages, max_tokens, temperature, top_p, time.time()):
#                     full_response += token
                
#                 session_manager._add_message_to_session(session_id, "assistant", full_response)
#                 return full_response
#             else:
#                 messages = [
#                     {"role": "system", "content": base_system_prompt},
#                     {"role": "user", "content": enhanced_prompt}
#                 ]
                
#                 # Stream and collect full response
#                 full_response = ""
#                 for token in self._stream_completion(messages, max_tokens, temperature, top_p, time.time()):
#                     full_response += token
                
#                 # Cache response if enabled
#                 if use_cache:
#                     self._cache_response(prompt, base_system_prompt, full_response)
                
#                 return full_response
                
#         except Exception as e:
#             logger.error(f" {self.provider.upper()} completion error: {e}", exc_info=True)
#             return "I'm sorry, I couldn't generate a response right now."
    
#     def generate_response_stream(
#         self, 
#         prompt: str, 
#         max_tokens: int = None, 
#         temperature: float = None, 
#         top_p: float = None,
#         request_id: str = None, 
#         session_id: str = None, 
#         use_rag: bool = True,
#         user_language: Optional[str] = None, 
#         system_prompt: Optional[str] = None
#     ) -> Generator[str, None, None]:
#         """
#         Generate response using streaming (yields tokens as they arrive)
#         Use this for real-time streaming to the client
#         """
#         from system_prompt import VIRTUAL_DOCTOR_SYSTEM_PROMPT
#         from database.redis import SessionManager
        
#         try:
#             max_tokens = max_tokens or getattr(settings, 'OPENAI_MAX_TOKENS', 200)
#             temperature = temperature or getattr(settings, 'OPENAI_TEMPERATURE', 0.2)
#             top_p = top_p or getattr(settings, 'OPENAI_TOP_P', 0.9)
            
#             base_system_prompt = system_prompt or VIRTUAL_DOCTOR_SYSTEM_PROMPT
            
#             # Build RAG context if available and enabled
#             rag_context = ""
#             if use_rag and self.rag_service:
#                 try:
#                     rag_start = time.time()
#                     rag_context = self.rag_service.build_context(prompt)
#                     rag_time = int((time.time() - rag_start) * 1000)
#                     if rag_context:
#                         logger.info(f" RAG context: {len(rag_context)} chars ({rag_time}ms)")
#                 except Exception as e:
#                     logger.warning(f" RAG retrieval failed: {e}")
            
#             # Enhance user prompt with RAG context if available
#             enhanced_prompt = prompt
#             if rag_context:
#                 enhanced_prompt = f"Relevant medical book context:\n{rag_context}\n\nPatient question: {prompt}"
            
#             if session_id:
#                 session_manager = SessionManager()
#                 session_manager._add_message_to_session(session_id, "user", enhanced_prompt)
#                 messages = session_manager.get_session_messages(session_id, base_system_prompt)
                
#                 # Stream tokens and collect full response
#                 full_response = ""
#                 for token in self._stream_completion(messages, max_tokens, temperature, top_p, time.time()):
#                     full_response += token
#                     yield token
                
#                 # Save full response to session
#                 session_manager._add_message_to_session(session_id, "assistant", full_response)
#             else:
#                 messages = [
#                     {"role": "system", "content": base_system_prompt},
#                     {"role": "user", "content": enhanced_prompt}
#                 ]
#                 for token in self._stream_completion(messages, max_tokens, temperature, top_p, time.time()):
#                     yield token
                    
#         except Exception as e:
#             logger.error(f" {self.provider.upper()} streaming error: {e}", exc_info=True)
#             yield "I'm sorry, I couldn't generate a response right now."
    
#     # Session Management Methods
#     def clear_session(self, session_id: str):
#         from database.redis import SessionManager
#         return SessionManager().clear_session(session_id)
    
#     def clear_all_sessions(self):
#         from database.redis import SessionManager
#         return SessionManager().clear_all_sessions()
    
#     def cleanup_expired_sessions(self):
#         from database.redis import SessionManager
#         return SessionManager().cleanup_expired_sessions()
    
#     def get_session_info(self):
#         from database.redis import SessionManager
#         return SessionManager().get_session_info()
    
#     def get_session_conversation(self, session_id: str):
#         from database.redis import SessionManager
#         return SessionManager().get_session_conversation(session_id)
    
#     def clear_cache(self):
#         """Clear response cache"""
#         self._response_cache.clear()
#         logger.info(" Response cache cleared")


# # Backward compatibility alias
# OpenAIChatService = UnifiedChatService




