"""
RAG Service - Production Grade
Optimized Retrieval-Augmented Generation with Redis caching and fast context building
"""

from typing import List, Optional
import time
import logging
import json
from openai import OpenAI
from config import settings
from system_prompt import VIRTUAL_DOCTOR_SYSTEM_PROMPT
from .retriever import RAGRetriever

logger = logging.getLogger(__name__)

# Import Redis for caching
try:
    from database.redis import redis_client
    REDIS_AVAILABLE = True
except Exception as e:
    logger.warning(f"Redis not available for RAG caching: {e}")
    REDIS_AVAILABLE = False
    redis_client = None


class RAGService:
    """Production-grade RAG service with optimized retrieval and context building"""
    
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=5.0,  # Ultra-fast timeout for real-time
            max_retries=0,  # No retries for maximum speed
            http_client=None  # Use default HTTP client with connection pooling
        )
        self.retriever = RAGRetriever()
        
        # Track last retrieval for analytics logging
        self.last_retrieval_time = 0.0
        self.last_chunks_count = 0
        
        # ULTRA-FAST: Performance tuning optimized for real-time conversations
        self._default_k = 2  # Only 2 chunks for speed (was 3)
        self._default_max_chars = 600  # Reduced for faster processing (was 800)
        self._min_relevance_score = 0.5  # Higher threshold for better quality
        
        # REDIS CACHE: Use Redis for persistent caching across restarts
        self._cache_ttl = getattr(settings, 'RAG_CACHE_TTL', 300)  # 5 minutes cache TTL
        self._redis_prefix = "rag:query:"  # Redis key prefix
        self._use_redis = REDIS_AVAILABLE and redis_client is not None
        
        # Fallback in-memory cache if Redis unavailable
        self._memory_cache = {}  # {query_hash: (context, timestamp)}
        self._max_cache_size = 100  # Limit in-memory cache size
        
        if self._use_redis:
            logger.info("RAG Service initialized with REDIS caching + ULTRA-FAST retrieval")
        else:
            logger.warning("RAG Service initialized with IN-MEMORY caching (Redis unavailable)")

    def _get_cache_key(self, query: str) -> str:
        """Generate cache key from query"""
        return str(hash(query.lower().strip()))
    
    def _get_cached_context(self, query: str) -> Optional[str]:
        """Get cached RAG context from Redis (or memory fallback) if available"""
        cache_key = self._get_cache_key(query)
        
        # Try Redis first
        if self._use_redis:
            try:
                redis_key = f"{self._redis_prefix}{cache_key}"
                cached_data = redis_client.get(redis_key)
                if cached_data:
                    context = cached_data.decode('utf-8') if isinstance(cached_data, bytes) else cached_data
                    logger.info(f"⚡ REDIS RAG CACHE HIT - Instant retrieval!")
                    return context
            except Exception as e:
                logger.warning(f"Redis cache read failed, trying memory: {e}")
        
        # Fallback to in-memory cache
        if cache_key in self._memory_cache:
            context, timestamp = self._memory_cache[cache_key]
            if time.time() - timestamp < self._cache_ttl:
                logger.info(f"⚡ MEMORY RAG CACHE HIT - Saved retrieval time!")
                return context
            else:
                del self._memory_cache[cache_key]
        
        return None
    
    def _cache_context(self, query: str, context: str):
        """Cache RAG context in Redis (or memory fallback) for future use"""
        cache_key = self._get_cache_key(query)
        
        # Try Redis first
        if self._use_redis:
            try:
                redis_key = f"{self._redis_prefix}{cache_key}"
                redis_client.setex(redis_key, self._cache_ttl, context)
                logger.debug(f"RAG context cached in Redis (TTL: {self._cache_ttl}s)")
                return
            except Exception as e:
                logger.warning(f"Redis cache write failed, using memory: {e}")
        
        # Fallback to in-memory cache
        if len(self._memory_cache) >= self._max_cache_size:
            oldest_key = min(self._memory_cache.keys(), 
                           key=lambda k: self._memory_cache[k][1])
            del self._memory_cache[oldest_key]
        
        self._memory_cache[cache_key] = (context, time.time())
        logger.debug(f"RAG context cached in memory")

    def build_context(
        self, 
        query: str, 
        k: int = None, 
        max_chars: int = None,
        min_relevance: float = None
    ) -> str:
        """
        Build RAG context from retrieved chunks with ULTRA-FAST optimizations
        
        Args:
            query: User query
            k: Number of chunks to retrieve (default: 2)
            max_chars: Maximum context characters (default: 600)
            min_relevance: Minimum relevance score 0-1 (default: 0.5)
        
        Returns:
            Formatted context string
        """
        # Fast path for simple queries
        simple_queries = ["hello", "hi", "ok", "thanks", "thank you", "yes", "no", "okay"]
        if query.lower().strip() in simple_queries:
            logger.debug(f"RAG Fast path: Skipping RAG for simple query")
            return ""
        
        # CHECK CACHE FIRST (ultra-fast path)
        cached = self._get_cached_context(query)
        if cached is not None:
            return cached
        
        # Optimized parameters for low latency
        k = k or self._default_k
        max_chars = max_chars or self._default_max_chars
        min_relevance = min_relevance if min_relevance is not None else self._min_relevance_score
        
        # Validate input
        if not query or not query.strip():
            logger.warning("RAG: Empty query provided")
            return ""
        
        # Track retrieval time (no timeout - always use RAG)
        start_time = time.time()
        
        try:
            # Always use RAG regardless of latency - no timeout
            chunks = self.retriever.retrieve(query, k)
            self.last_retrieval_time = time.time() - start_time
            self.last_chunks_count = len(chunks) if chunks else 0
            
            # Always use RAG context regardless of latency - no timeout
            logger.info(f"RAG: Retrieved {len(chunks)} chunks in {self.last_retrieval_time*1000:.0f}ms (no latency limits)")
            
            if not chunks:
                logger.info(f"RAG: No chunks found for query: {query[:50]}...")
                return ""
            
            # Filter by relevance if specified (distance metric: lower is better, 0-2 range)
            if min_relevance is not None:
                # Convert min_relevance (0-1, higher is better) to max_distance (0-2, lower is better)
                max_distance = 2 * (1 - min_relevance)
                filtered_chunks = [ch for ch in chunks if ch.get('distance', 0) <= max_distance]
                if len(filtered_chunks) < len(chunks):
                    logger.info(f"RAG: Filtered {len(chunks) - len(filtered_chunks)} low-relevance chunks")
                chunks = filtered_chunks
            
            if not chunks:
                logger.info(f"RAG: No relevant chunks after filtering")
                return ""
            
            # ULTRA-FAST: Build context with minimal processing
            parts: List[str] = []
            total_chars = 0
            
            # SPEED OPTIMIZED: Only use top 2 chunks
            max_chunks = 2
            
            for i, ch in enumerate(chunks[:max_chunks]):
                text = ch.get('text', '')
                
                # Skip empty chunks
                if not text.strip():
                    continue
                
                # If we already have some chunks and this would exceed limit, stop
                if parts and total_chars + len(text) > max_chars:
                    break
                
                # If this is the first chunk and it's too large, truncate it
                if not parts and len(text) > max_chars:
                    text = text[:max_chars]
                
                # ULTRA-SIMPLIFIED format for speed (no page numbers in real-time)
                parts.append(text)
                total_chars += len(text)
            
            if not parts:
                logger.debug(f"RAG: No valid chunks after processing")
                return ""
            
            ctx = "\n\n".join(parts)
            
            # CACHE THE RESULT for future identical queries
            self._cache_context(query, ctx)
            
            avg_relevance = sum((1 - ch.get('distance', 0) / 2) * 100 for ch in chunks[:len(parts)]) / len(parts)
            logger.info(
                f"⚡ RAG: {len(parts)} chunks, {len(ctx)} chars, "
                f"{avg_relevance:.0f}% relevance ({self.last_retrieval_time*1000:.0f}ms)"
            )
            return ctx
            
        except Exception as e:
            logger.error(f"RAG context building error: {e}", exc_info=True)
            return ""

    def answer(
        self, 
        query: str, 
        max_tokens: int = None, 
        temperature: float = None,
        use_streaming: bool = False
    ) -> str:
        """
        Generate answer using RAG context (standalone method, not used in main flow)
        
        Args:
            query: User query
            max_tokens: Max tokens in response
            temperature: Sampling temperature
            use_streaming: Use streaming API
        
        Returns:
            Generated answer
        """
        max_tokens = max_tokens or settings.RAG_MAX_TOKENS
        temperature = temperature or settings.RAG_TEMPERATURE
        
        try:
            ctx = self.build_context(query)
            system_prompt = VIRTUAL_DOCTOR_SYSTEM_PROMPT
            user_prompt = f"Context from book:\n{ctx or '[no relevant context found]'}\n\nPatient question: {query}"
            
            if use_streaming:
                # Use streaming for better performance
                full_response = ""
                stream = self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=max_tokens,
                    temperature=temperature,
                    stream=True
                )
                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        full_response += chunk.choices[0].delta.content
                return full_response
            else:
                # Non-streaming mode
                resp = self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                return resp.choices[0].message.content or ""
                
        except Exception as e:
            logger.error(f"RAG answer generation error: {e}", exc_info=True)
            return "I'm sorry, I couldn't generate an answer right now."
    
    def get_stats(self) -> dict:
        """Get RAG service statistics"""
        return {
            "last_retrieval_time_ms": int(self.last_retrieval_time * 1000),
            "last_chunks_count": self.last_chunks_count,
            "cache_size": len(self.retriever._embedding_cache),
            "cache_hit_rate": self.retriever.get_cache_stats().get("hit_rate", 0)
        }
