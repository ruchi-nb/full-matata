"""
RAG Service - Production Grade
Optimized Retrieval-Augmented Generation with caching and fast context building
"""

from typing import List, Optional
import time
import logging
from openai import OpenAI
from config import settings
from system_prompt import VIRTUAL_DOCTOR_SYSTEM_PROMPT
from .retriever import RAGRetriever

logger = logging.getLogger(__name__)


class RAGService:
    """Production-grade RAG service with optimized retrieval and context building"""
    
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=10.0,  # Reduced timeout for faster RAG queries
            max_retries=1,  # Reduced retries for faster response
            http_client=None  # Use default HTTP client with connection pooling
        )
        self.retriever = RAGRetriever()
        
        # Track last retrieval for analytics logging
        self.last_retrieval_time = 0.0
        self.last_chunks_count = 0
        
        # Performance tuning - optimized for speed and quality
        self._default_k = 3  # Retrieve top 3 chunks for better context
        self._default_max_chars = 800  # Reduced for faster processing
        self._min_relevance_score = 0.4  # Lower threshold for more results
        
        logger.info("RAG Service initialized with optimized retrieval")

    def build_context(
        self, 
        query: str, 
        k: int = None, 
        max_chars: int = None,
        min_relevance: float = None
    ) -> str:
        """
        Build RAG context from retrieved chunks with optimizations
        
        Args:
            query: User query
            k: Number of chunks to retrieve (default: 2)
            max_chars: Maximum context characters (default: 1500)
            min_relevance: Minimum relevance score 0-1 (default: None, all chunks)
        
        Returns:
            Formatted context string
        """
        # Fast path for simple queries
        simple_queries = ["hello", "hi", "ok", "thanks", "thank you", "yes", "no", "okay"]
        if query.lower().strip() in simple_queries:
            logger.info(f"RAG Fast path: Skipping RAG for simple query '{query}'")
            return ""
        
        # Optimized parameters for low latency
        k = k or self._default_k
        max_chars = max_chars or self._default_max_chars
        min_relevance = min_relevance if min_relevance is not None else None
        
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
            
            # Ultra-fast: Build context with minimal processing
            parts: List[str] = []
            total_chars = 0
            
            # Limit to first 2 chunks for balanced speed and quality
            max_chunks = min(len(chunks), 2)
            
            for i, ch in enumerate(chunks[:max_chunks]):
                text = ch.get('text', '')
                
                # Skip empty chunks
                if not text.strip():
                    continue
                
                # If we already have some chunks and this would exceed limit, stop
                if parts and total_chars + len(text) > max_chars:
                    logger.debug(f"RAG: Stopped at chunk {i+1}/{max_chunks} (char limit reached)")
                    break
                
                # If this is the first chunk and it's too large, truncate it
                if not parts and len(text) > max_chars:
                    text = text[:max_chars]
                    logger.debug(f"RAG: Truncated first chunk to {max_chars} chars")
                
                # Simplified chunk format for speed
                page = ch.get('page', 'unknown')
                side = ch.get('side', '')
                
                # Build simplified chunk
                if side:
                    chunk_text = f"Page {page} ({side}): {text}"
                else:
                    chunk_text = f"Page {page}: {text}"
                
                parts.append(chunk_text)
                total_chars += len(chunk_text)
            
            if not parts:
                logger.info(f"RAG: No valid chunks after processing")
                return ""
            
            ctx = "\n\n".join(parts)
            avg_relevance = sum((1 - ch.get('distance', 0) / 2) * 100 for ch in chunks[:len(parts)]) / len(parts)
            logger.info(
                f"RAG: Retrieved {len(parts)}/{len(chunks)} chunks, "
                f"{len(ctx)} chars, {avg_relevance:.0f}% avg relevance "
                f"(took {self.last_retrieval_time*1000:.0f}ms)"
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
