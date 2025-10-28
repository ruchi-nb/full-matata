"""
RAG Retriever - Production Grade with Specialty Filtering
Optimized vector similarity search with specialty-based filtering, citations, and caching
Ultra-low latency design for real-time medical consultations
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
    """Production-grade RAG retriever with specialty filtering and citation tracking"""
    
    def __init__(self, collection: str = "medical_books"):
        self.client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=8.0,  # Optimized timeout for embeddings
            max_retries=1,  # Reduced retries for speed
            http_client=None  # Use default HTTP client with connection pooling
        )
        self.vs = VectorStore(collection_name=collection)
        
        # Enhanced embedding cache for faster repeated queries
        self._embedding_cache: Dict[str, tuple] = {}  # {query_hash: (embedding, timestamp)}
        self._cache_ttl = 1800  # 30 minutes cache TTL
        self._max_cache_size = 500  # Cache size for better hit rate
        
        # Cache statistics
        self._cache_hits = 0
        self._cache_misses = 0
        
        # Fast path for common queries
        self._fast_queries = {
            "hello", "hi", "ok", "thanks", "thank you", "yes", "no", 
            "okay", "sure", "alright", "fine", "good", "great", "nice", "cool"
        }
        
        logger.info(
            f"RAG Retriever initialized: collection={collection}, "
            f"cache_size={self._max_cache_size}, ttl={self._cache_ttl}s"
        )

    def _get_cache_key(self, query: str, specialty: Optional[str] = None) -> str:
        """Generate cache key from query and specialty"""
        normalized = query.lower().strip()
        if specialty:
            normalized = f"{specialty.lower()}:{normalized}"
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def _get_cached_embedding(self, query: str, specialty: Optional[str] = None) -> Optional[List[float]]:
        """Get embedding from cache if available and not expired"""
        cache_key = self._get_cache_key(query, specialty)
        if cache_key in self._embedding_cache:
            embedding, timestamp = self._embedding_cache[cache_key]
            if time.time() - timestamp < self._cache_ttl:
                self._cache_hits += 1
                return embedding
            else:
                del self._embedding_cache[cache_key]
        self._cache_misses += 1
        return None
    
    def _cache_embedding(self, query: str, embedding: List[float], specialty: Optional[str] = None):
        """Cache embedding for future use with LRU eviction"""
        cache_key = self._get_cache_key(query, specialty)
        
        # LRU eviction if cache is full
        if len(self._embedding_cache) >= self._max_cache_size:
            oldest_key = min(
                self._embedding_cache.keys(), 
                key=lambda k: self._embedding_cache[k][1]
            )
            del self._embedding_cache[oldest_key]
            logger.debug("RAG Cache: Evicted oldest entry")
        
        self._embedding_cache[cache_key] = (embedding, time.time())

    def retrieve(
        self, 
        query: str, 
        k: int = 5,
        specialty: Optional[str] = None,
        min_relevance: float = 0.0,
        include_citations: bool = True
    ) -> List[dict]:
        """
        Retrieve relevant chunks from vector store with specialty filtering
        
        Args:
            query: User query
            k: Number of chunks to retrieve
            specialty: Medical specialty to filter by (e.g., "cardiology")
            min_relevance: Minimum similarity threshold (0-1)
            include_citations: Include source citations in results
        
        Returns:
            List of chunks with metadata, citations, and relevance scores
        """
        start_time = time.time()
        
        try:
            # Validate input
            if not query or not query.strip():
                logger.warning("RAG Retriever: Empty query provided")
                return []
            
            # Fast path for simple queries - skip RAG entirely
            if query.lower().strip() in self._fast_queries:
                logger.info(f"RAG Fast path: Skipping for simple query '{query}'")
                return []
            
            # Check cache first
            q_emb = self._get_cached_embedding(query, specialty)
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
                    self._cache_embedding(query, q_emb, specialty)
                    
                    logger.debug(f"RAG Embedding: {embedding_time}ms")
                    
                except Exception as e:
                    logger.error(f"RAG Embedding error: {e}")
                    return []
            
            # Log cache performance
            hit_rate = (self._cache_hits / (self._cache_hits + self._cache_misses) * 100) if (self._cache_hits + self._cache_misses) > 0 else 0
            logger.info(
                f"RAG Embedding {'✓ CACHE HIT' if cache_hit else '✗ Cache miss'} "
                f"(hit rate: {hit_rate:.1f}%{f', specialty: {specialty}' if specialty else ''})"
            )
            
            # Query vector store with specialty filter
            try:
                query_start = time.time()
                optimized_k = min(k, 3)  # Max 3 results for speed
                res = self.vs.query(
                    query_embeddings=[q_emb], 
                    n_results=optimized_k,
                    specialty=specialty
                )
                query_time = int((time.time() - query_start) * 1000)
                logger.debug(f"RAG Vector search: {query_time}ms (k={optimized_k})")
                
                # Ultra-fast: timeout if too slow (optional, can be removed for accuracy)
                if query_time > 300:  # 300ms timeout
                    logger.warning(f"RAG Vector search slow ({query_time}ms)")
                    # Continue anyway - don't skip results
                    
            except Exception as e:
                logger.error(f"RAG Vector store query error: {e}")
                return []
            
            # Parse results with enhanced metadata
            out: List[dict] = []
            for docs, metas, dists in zip(
                res.get("documents", [[]]), 
                res.get("metadatas", [[]]), 
                res.get("distances", [[]])
            ):
                for idx, (doc, meta, dist) in enumerate(zip(docs, metas, dists)):
                    # Convert distance to similarity (0-1, higher is better)
                    similarity = 1 - (dist / 2)  # ChromaDB cosine distance is 0-2
                    
                    # Filter by minimum relevance
                    if similarity < min_relevance:
                        continue
                    
                    chunk_data = {
                        "text": doc,
                        "distance": float(dist),
                        "similarity": round(similarity, 4),
                        "rank": idx + 1,
                        "metadata": meta
                    }
                    
                    # Add citation information
                    if include_citations:
                        chunk_data["citation"] = {
                            "source": meta.get("source_file", meta.get("book_name", "Unknown")),
                            "page": meta.get("page", "N/A"),
                            "specialty": meta.get("specialty", "N/A")
                        }
                    
                    out.append(chunk_data)
            
            total_time = int((time.time() - start_time) * 1000)
            
            if out:
                avg_similarity = sum(ch['similarity'] for ch in out) / len(out)
                logger.info(
                    f"⚡ RAG Retrieved: {len(out)} chunks in {total_time}ms "
                    f"(avg similarity: {avg_similarity:.2%}{f', specialty: {specialty}' if specialty else ''})"
                )
            else:
                logger.info(f"RAG: No relevant chunks found (total time: {total_time}ms)")
            
            return out
            
        except Exception as e:
            logger.error(f"RAG Retrieval error: {e}", exc_info=True)
            return []
    
    def retrieve_with_sources(
        self,
        query: str,
        k: int = 5,
        specialty: Optional[str] = None,
        min_relevance: float = 0.3
    ) -> Dict[str, any]:
        """
        Enhanced retrieval with aggregated sources and confidence metrics
        
        Args:
            query: User query
            k: Number of chunks
            specialty: Medical specialty filter
            min_relevance: Minimum similarity threshold
        
        Returns:
            Dict with chunks, sources, confidence, and metadata
        """
        chunks = self.retrieve(
            query=query,
            k=k,
            specialty=specialty,
            min_relevance=min_relevance,
            include_citations=True
        )
        
        if not chunks:
            return {
                "chunks": [],
                "sources": [],
                "confidence": 0.0,
                "specialty": specialty,
                "chunks_found": 0
            }
        
        # Aggregate sources
        sources_dict = {}
        for chunk in chunks:
            citation = chunk.get("citation", {})
            source = citation.get("source", "Unknown")
            if source not in sources_dict:
                sources_dict[source] = {
                    "source": source,
                    "pages": set(),
                    "specialty": citation.get("specialty", "N/A"),
                    "max_similarity": 0.0,
                    "chunk_count": 0
                }
            
            sources_dict[source]["pages"].add(str(citation.get("page", "N/A")))
            sources_dict[source]["max_similarity"] = max(
                sources_dict[source]["max_similarity"],
                chunk.get("similarity", 0.0)
            )
            sources_dict[source]["chunk_count"] += 1
        
        # Convert to list and format pages
        sources = []
        for source_data in sources_dict.values():
            source_data["pages"] = sorted(list(source_data["pages"]))
            sources.append(source_data)
        
        # Sort sources by relevance
        sources.sort(key=lambda x: x["max_similarity"], reverse=True)
        
        # Calculate overall confidence
        confidence = max(ch["similarity"] for ch in chunks)
        
        return {
            "chunks": chunks,
            "sources": sources,
            "confidence": confidence,
            "specialty": specialty,
            "chunks_found": len(chunks)
        }
    
    def get_cache_stats(self) -> dict:
        """Get cache statistics"""
        total_requests = self._cache_hits + self._cache_misses
        hit_rate = (self._cache_hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "cache_size": len(self._embedding_cache),
            "max_cache_size": self._max_cache_size,
            "cache_hits": self._cache_hits,
            "cache_misses": self._cache_misses,
            "hit_rate": round(hit_rate, 2),
            "cache_ttl_seconds": self._cache_ttl
        }
    
    def clear_cache(self):
        """Clear embedding cache"""
        self._embedding_cache.clear()
        self._cache_hits = 0
        self._cache_misses = 0
        logger.info("RAG embedding cache cleared")
    
    def warm_cache(self, queries: List[str], specialty: Optional[str] = None):
        """Pre-warm cache with common queries for a specialty"""
        logger.info(f"Warming RAG cache with {len(queries)} queries...")
        for query in queries:
            try:
                self.retrieve(query, k=1, specialty=specialty)
            except Exception as e:
                logger.warning(f"Cache warming failed for query: {e}")
        logger.info(f"Cache warmed: {len(self._embedding_cache)} embeddings cached")
