"""
RAG Retriever - Production Grade
Optimized vector similarity search with embedding caching and error handling
"""

from typing import List, Dict, Optional
import logging
import time
import hashlib
from openai import OpenAI
from config import settings
from .vector_store import VectorStore

logger = logging.getLogger(__name__)


class RAGRetriever:
    """Production-grade RAG retriever with embedding cache and optimized search"""
    
    def __init__(self, collection: str = "medical_book"):
        self.client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=8.0,  # Optimized timeout for embeddings
            max_retries=1,  # Reduced retries for speed
            http_client=None  # Use default HTTP client with connection pooling
        )
        self.vs = VectorStore(collection_name=collection)
        
        # Enhanced embedding cache for faster repeated queries
        self._embedding_cache: Dict[str, tuple] = {}  # {query_hash: (embedding, timestamp)}
        self._cache_ttl = 1800  # 30 minutes cache TTL (increased for better hit rate)
        self._max_cache_size = 500  # Increased cache size for better hit rate
        
        # Cache statistics
        self._cache_hits = 0
        self._cache_misses = 0
        
        # Fast path for common queries - expanded list
        self._fast_queries = {
            "hello": "greeting",
            "hi": "greeting", 
            "ok": "acknowledgment",
            "thanks": "acknowledgment",
            "thank you": "acknowledgment",
            "yes": "acknowledgment",
            "no": "acknowledgment",
            "okay": "acknowledgment",
            "sure": "acknowledgment",
            "alright": "acknowledgment",
            "fine": "acknowledgment",
            "good": "acknowledgment",
            "great": "acknowledgment",
            "nice": "acknowledgment",
            "cool": "acknowledgment"
        }
        
        logger.info(f"RAG Retriever initialized (collection: {collection}, cache_size: {self._max_cache_size})")

    def _get_cache_key(self, query: str) -> str:
        """Generate cache key from query"""
        # Normalize query for better cache hits
        normalized = query.lower().strip()
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def _get_cached_embedding(self, query: str) -> Optional[List[float]]:
        """Get embedding from cache if available and not expired"""
        cache_key = self._get_cache_key(query)
        if cache_key in self._embedding_cache:
            embedding, timestamp = self._embedding_cache[cache_key]
            if time.time() - timestamp < self._cache_ttl:
                self._cache_hits += 1
                return embedding
            else:
                # Expired, remove from cache
                del self._embedding_cache[cache_key]
        self._cache_misses += 1
        return None
    
    def _cache_embedding(self, query: str, embedding: List[float]):
        """Cache embedding for future use with LRU eviction"""
        cache_key = self._get_cache_key(query)
        
        # Limit cache size (LRU eviction)
        if len(self._embedding_cache) >= self._max_cache_size:
            # Remove oldest entry based on timestamp
            oldest_key = min(
                self._embedding_cache.keys(), 
                key=lambda k: self._embedding_cache[k][1]
            )
            del self._embedding_cache[oldest_key]
            logger.debug(f"RAG Cache: Evicted oldest entry")
        
        self._embedding_cache[cache_key] = (embedding, time.time())

    def retrieve(self, query: str, k: int = 5) -> List[dict]:
        """
        Retrieve relevant chunks from vector store with caching
        
        Args:
            query: User query
            k: Number of chunks to retrieve
        
        Returns:
            List of chunks with metadata
        """
        start_time = time.time()
        
        try:
            # Validate input
            if not query or not query.strip():
                logger.warning("RAG Retriever: Empty query provided")
                return []
            
            # Fast path for simple queries - skip RAG entirely
            query_lower = query.lower().strip()
            if query_lower in self._fast_queries:
                logger.info(f"RAG Fast path: Skipping RAG for simple query '{query_lower}'")
                return []
            
            # Check cache first
            q_emb = self._get_cached_embedding(query)
            cache_hit = q_emb is not None
            
            if not cache_hit:
                # Cache miss - fetch from OpenAI
                try:
                    embedding_start = time.time()
                    response = self.client.embeddings.create(
                        model="text-embedding-3-small", 
                        input=query
                    )
                    q_emb = response.data[0].embedding
                    embedding_time = int((time.time() - embedding_start) * 1000)
                    
                    # Cache for future use
                    self._cache_embedding(query, q_emb)
                    
                    logger.debug(f"RAG Embedding generated: {embedding_time}ms")
                    
                except Exception as e:
                    logger.error(f"RAG Embedding error: {e}")
                    return []
            
            # Log cache performance
            hit_rate = (self._cache_hits / (self._cache_hits + self._cache_misses) * 100) if (self._cache_hits + self._cache_misses) > 0 else 0
            logger.info(
                f"RAG Embedding {'Cache HIT' if cache_hit else 'Cache MISS'} "
                f"(cache: {len(self._embedding_cache)}/{self._max_cache_size}, "
                f"hit rate: {hit_rate:.1f}%)"
            )
            
            # Query the vector store with aggressive timeout
            try:
                query_start = time.time()
                # Ultra-fast: max 2 results for speed but still useful
                optimized_k = min(k, 2)  # Max 2 results for speed
                res = self.vs.query([q_emb], n_results=optimized_k)
                query_time = int((time.time() - query_start) * 1000)
                logger.debug(f"RAG Vector search: {query_time}ms (k={optimized_k})")
                
                # If query takes too long, return empty
                if query_time > 200:  # 200ms timeout for ultra-fast
                    logger.warning(f"RAG Vector search too slow ({query_time}ms), returning empty")
                    return []
            except Exception as e:
                logger.error(f"RAG Vector store query error: {e}")
                return []
            
            # Parse results
            out: List[dict] = []
            for docs, metas, dists in zip(
                res.get("documents", [[]]), 
                res.get("metadatas", [[]]), 
                res.get("distances", [[]])
            ):
                for doc, meta, dist in zip(docs, metas, dists):
                    out.append({
                        "text": doc,
                        "page": meta.get("page"),
                        "side": meta.get("side"),
                        "distance": float(dist)
                    })
            
            total_time = int((time.time() - start_time) * 1000)
            logger.debug(f"RAG Retrieval complete: {len(out)} chunks in {total_time}ms")
            
            return out
            
        except Exception as e:
            logger.error(f"RAG Retrieval error: {e}", exc_info=True)
            return []
    
    def get_cache_stats(self) -> dict:
        """Get cache statistics"""
        total_requests = self._cache_hits + self._cache_misses
        hit_rate = (self._cache_hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "cache_size": len(self._embedding_cache),
            "max_cache_size": self._max_cache_size,
            "cache_hits": self._cache_hits,
            "cache_misses": self._cache_misses,
            "hit_rate": hit_rate,
            "cache_ttl_seconds": self._cache_ttl
        }
    
    def clear_cache(self):
        """Clear embedding cache"""
        self._embedding_cache.clear()
        self._cache_hits = 0
        self._cache_misses = 0
        logger.info("RAG embedding cache cleared")
    
    def warm_cache(self, queries: List[str]):
        """Pre-warm cache with common queries"""
        logger.info(f"Warming RAG cache with {len(queries)} queries...")
        for query in queries:
            try:
                self.retrieve(query, k=1)  # Minimal retrieval just to cache embedding
            except Exception as e:
                logger.warning(f"Cache warming failed for query: {e}")
        logger.info(f"Cache warmed: {len(self._embedding_cache)} embeddings cached")
