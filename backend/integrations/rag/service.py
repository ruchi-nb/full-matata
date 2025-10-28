"""
RAG Service - Production Grade with Specialty Support
Optimized Retrieval-Augmented Generation with specialty filtering, citations, and query history
Ultra-low latency design for real-time medical consultations
"""

from typing import List, Optional, Dict, Any
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
    """Production-grade RAG service with specialty filtering and enhanced features"""
    
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=5.0,  # Ultra-fast timeout for real-time
            max_retries=0,  # No retries for maximum speed
            http_client=None  # Use default HTTP client with connection pooling
        )
        self.retriever = RAGRetriever()
        
        # Query history (in-memory, consider moving to Redis for persistence)
        self._query_history: List[Dict[str, Any]] = []
        self._max_history_size = 100
        
        # Track last retrieval for analytics
        self.last_retrieval_time = 0.0
        self.last_chunks_count = 0
        
        # ULTRA-FAST: Performance tuning for real-time conversations
        self._default_k = 3  # 3 chunks for good context
        self._default_max_chars = 1500  # More context for better answers
        self._min_relevance_score = 0.3  # Higher threshold for quality
        
        # REDIS CACHE: Persistent caching across restarts
        self._cache_ttl = getattr(settings, 'RAG_CACHE_TTL', 300)  # 5 minutes
        self._redis_prefix = "rag:context:"
        self._use_redis = REDIS_AVAILABLE and redis_client is not None
        
        # Fallback in-memory cache
        self._memory_cache = {}
        self._max_cache_size = 100
        
        logger.info(
            f"RAG Service initialized: "
            f"{'REDIS caching' if self._use_redis else 'Memory caching'}, "
            f"k={self._default_k}, max_chars={self._default_max_chars}, "
            f"min_relevance={self._min_relevance_score}"
        )

    def _get_cache_key(self, query: str, specialty: Optional[str] = None) -> str:
        """Generate cache key from query and specialty"""
        key = query.lower().strip()
        if specialty:
            key = f"{specialty.lower()}:{key}"
        return str(hash(key))
    
    def _get_cached_context(self, query: str, specialty: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get cached RAG context from Redis (or memory fallback)"""
        cache_key = self._get_cache_key(query, specialty)
        
        # Try Redis first
        if self._use_redis:
            try:
                redis_key = f"{self._redis_prefix}{cache_key}"
                cached_data = redis_client.get(redis_key)
                if cached_data:
                    data = json.loads(cached_data.decode('utf-8') if isinstance(cached_data, bytes) else cached_data)
                    logger.info(f"⚡ REDIS RAG CACHE HIT - Instant retrieval!")
                    return data
            except Exception as e:
                logger.warning(f"Redis cache read failed, trying memory: {e}")
        
        # Fallback to in-memory cache
        if cache_key in self._memory_cache:
            data, timestamp = self._memory_cache[cache_key]
            if time.time() - timestamp < self._cache_ttl:
                logger.info(f"⚡ MEMORY RAG CACHE HIT - Saved retrieval time!")
                return data
            else:
                del self._memory_cache[cache_key]
        
        return None
    
    def _cache_context(self, query: str, context_data: Dict[str, Any], specialty: Optional[str] = None):
        """Cache RAG context in Redis (or memory fallback)"""
        cache_key = self._get_cache_key(query, specialty)
        
        # Try Redis first
        if self._use_redis:
            try:
                redis_key = f"{self._redis_prefix}{cache_key}"
                redis_client.setex(redis_key, self._cache_ttl, json.dumps(context_data))
                logger.debug(f"RAG context cached in Redis (TTL: {self._cache_ttl}s)")
                return
            except Exception as e:
                logger.warning(f"Redis cache write failed, using memory: {e}")
        
        # Fallback to in-memory cache
        if len(self._memory_cache) >= self._max_cache_size:
            oldest_key = min(self._memory_cache.keys(), 
                           key=lambda k: self._memory_cache[k][1])
            del self._memory_cache[oldest_key]
        
        self._memory_cache[cache_key] = (context_data, time.time())
        logger.debug(f"RAG context cached in memory")

    def build_context(
        self, 
        query: str,
        specialty: Optional[str] = None,
        k: int = None, 
        max_chars: int = None,
        min_relevance: float = None,
        include_sources: bool = False
    ) -> Dict[str, Any]:
        """
        Build RAG context from retrieved chunks with specialty filtering
        
        Args:
            query: User query
            specialty: Medical specialty to filter by (e.g., "cardiology")
            k: Number of chunks to retrieve (default: 3)
            max_chars: Maximum context characters (default: 1500)
            min_relevance: Minimum relevance score 0-1 (default: 0.3)
            include_sources: Include source citations in response
        
        Returns:
            Dict with context, sources, and metadata
        """
        # Fast path for simple queries
        simple_queries = {"hello", "hi", "ok", "thanks", "thank you", "yes", "no", "okay"}
        if query.lower().strip() in simple_queries:
            logger.debug(f"RAG Fast path: Skipping for simple query")
            return {"context": "", "sources": [], "chunks_used": 0}
        
        # CHECK CACHE FIRST
        cached = self._get_cached_context(query, specialty)
        if cached is not None:
            return cached
        
        # Optimized parameters
        k = k or self._default_k
        max_chars = max_chars or self._default_max_chars
        min_relevance = min_relevance if min_relevance is not None else self._min_relevance_score
        
        # Validate input
        if not query or not query.strip():
            logger.warning("RAG: Empty query provided")
            return {"context": "", "sources": [], "chunks_used": 0}
        
        # Track retrieval time
        start_time = time.time()
        
        try:
            # Retrieve with specialty filter and sources
            result = self.retriever.retrieve_with_sources(
                query=query,
                k=k,
                specialty=specialty,
                min_relevance=min_relevance
            )
            
            chunks = result.get("chunks", [])
            sources = result.get("sources", [])
            confidence = result.get("confidence", 0.0)
            
            self.last_retrieval_time = time.time() - start_time
            self.last_chunks_count = len(chunks)
            
            logger.info(
                f"RAG: Retrieved {len(chunks)} chunks in {self.last_retrieval_time*1000:.0f}ms "
                f"(confidence: {confidence:.2%}{f', specialty: {specialty}' if specialty else ''})"
            )
            
            if not chunks:
                logger.info(f"RAG: No relevant chunks found")
                return {"context": "", "sources": [], "chunks_used": 0, "specialty": specialty}
            
            # Build context with smart truncation
            context_parts: List[str] = []
            total_chars = 0
            chunks_used = 0
            
            for chunk in chunks:
                text = chunk.get('text', '').strip()
                if not text:
                    continue
                
                # If adding this chunk would exceed limit, check if we should truncate or skip
                if total_chars + len(text) > max_chars:
                    if chunks_used == 0:
                        # First chunk, truncate it
                        text = text[:max_chars]
                        context_parts.append(text)
                        chunks_used += 1
                    break
                
                context_parts.append(text)
                total_chars += len(text)
                chunks_used += 1
            
            context = "\n\n".join(context_parts)
            
            # Build response
            context_data = {
                "context": context,
                "chunks_used": chunks_used,
                "total_chars": len(context),
                "confidence": confidence,
                "specialty": specialty,
                "retrieval_time_ms": int(self.last_retrieval_time * 1000)
            }
            
            if include_sources:
                context_data["sources"] = sources
            
            # CACHE THE RESULT
            self._cache_context(query, context_data, specialty)
            
            logger.info(
                f"⚡ RAG Context built: {chunks_used} chunks, {len(context)} chars, "
                f"{confidence:.1%} confidence ({self.last_retrieval_time*1000:.0f}ms)"
            )
            
            return context_data
            
        except Exception as e:
            logger.error(f"RAG context building error: {e}", exc_info=True)
            return {"context": "", "sources": [], "chunks_used": 0, "error": str(e)}

    def answer(
        self, 
        query: str,
        specialty: Optional[str] = None,
        max_tokens: int = None, 
        temperature: float = None,
        include_sources: bool = True,
        use_streaming: bool = False
    ) -> Dict[str, Any]:
        """
        Generate answer using RAG context with specialty filtering
        
        Args:
            query: User query
            specialty: Medical specialty to filter by
            max_tokens: Max tokens in response
            temperature: Sampling temperature
            include_sources: Include source citations
            use_streaming: Use streaming API
        
        Returns:
            Dict with answer, sources, and metadata
        """
        start_time = time.time()
        max_tokens = max_tokens or getattr(settings, 'RAG_MAX_TOKENS', 500)
        temperature = temperature or getattr(settings, 'RAG_TEMPERATURE', 0.3)
        
        try:
            # Build context with sources
            context_result = self.build_context(
                query, 
                specialty=specialty,
                include_sources=include_sources
            )
            
            context = context_result.get("context", "")
            sources = context_result.get("sources", [])
            confidence = context_result.get("confidence", 0.0)
            
            # Build prompt
            system_prompt = VIRTUAL_DOCTOR_SYSTEM_PROMPT
            
            if context:
                user_prompt = f"""Reference Material from Medical Textbook:
{context}

Patient Question: {query}

Please provide a clear, accurate answer based on the reference material above."""
            else:
                user_prompt = f"""Patient Question: {query}

Note: No specific reference material available for this query. Please provide a general medical response based on your training."""
            
            # Generate response
            if use_streaming:
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
                answer = full_response
            else:
                resp = self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                answer = resp.choices[0].message.content or ""
            
            # Build citations if sources available
            citations = []
            if include_sources and sources:
                for idx, source in enumerate(sources, 1):
                    pages = ", ".join(source.get("pages", []))
                    citation = f"[{idx}] {source.get('source', 'Unknown')} (pages: {pages}, similarity: {source.get('max_similarity', 0):.1%})"
                    citations.append(citation)
            
            total_time = time.time() - start_time
            
            # Store in query history
            history_entry = {
                "query": query,
                "answer": answer,
                "specialty": specialty,
                "sources": sources[:3] if sources else [],  # Store top 3 sources
                "confidence": confidence,
                "timestamp": time.time(),
                "total_time_ms": int(total_time * 1000)
            }
            
            self._add_to_history(history_entry)
            
            logger.info(
                f"RAG Answer generated: {len(answer)} chars in {total_time*1000:.0f}ms "
                f"(confidence: {confidence:.1%}, sources: {len(sources)})"
            )
            
            return {
                "answer": answer,
                "citations": citations,
                "sources": sources if include_sources else [],
                "confidence": confidence,
                "specialty": specialty,
                "metrics": {
                    "total_time_ms": int(total_time * 1000),
                    "chunks_used": context_result.get("chunks_used", 0),
                    "context_chars": len(context)
                }
            }
                
        except Exception as e:
            logger.error(f"RAG answer generation error: {e}", exc_info=True)
            return {
                "answer": "I'm sorry, I couldn't generate an answer right now.",
                "citations": [],
                "sources": [],
                "error": str(e)
            }
    
    def _add_to_history(self, entry: Dict[str, Any]):
        """Add query to history with size limit"""
        self._query_history.append(entry)
        if len(self._query_history) > self._max_history_size:
            self._query_history.pop(0)
    
    def get_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent query history"""
        return self._query_history[-limit:]
    
    def clear_history(self):
        """Clear query history"""
        self._query_history.clear()
        logger.info("Query history cleared")
    
    def get_stats(self) -> dict:
        """Get RAG service statistics"""
        retriever_stats = self.retriever.get_cache_stats()
        
        return {
            "last_retrieval_time_ms": int(self.last_retrieval_time * 1000),
            "last_chunks_count": self.last_chunks_count,
            "query_history_size": len(self._query_history),
            "embedding_cache_size": retriever_stats.get("cache_size", 0),
            "embedding_cache_hit_rate": retriever_stats.get("hit_rate", 0),
            "context_cache_type": "redis" if self._use_redis else "memory",
            "context_cache_size": len(self._memory_cache) if not self._use_redis else "N/A"
        }
