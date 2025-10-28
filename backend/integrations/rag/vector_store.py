"""
Vector Store - Production Grade
ChromaDB wrapper with optimized connection management
"""

import os
import logging
import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class VectorStore:
    """Production-grade ChromaDB vector store wrapper"""
    
    def __init__(
        self, 
        persist_dir: str = "./data/chroma", 
        collection_name: str = "medical_book"
    ):
        """
        Initialize ChromaDB vector store with persistent storage
        
        Args:
            persist_dir: Directory for persistent storage
            collection_name: Name of the collection
        """
        # Ensure persist directory exists
        os.makedirs(persist_dir, exist_ok=True)
        
        # Initialize ChromaDB client with optimized settings for speed
        try:
            self.client = chromadb.PersistentClient(
                path=persist_dir,
                settings=Settings(
                    anonymized_telemetry=False,
                    allow_reset=False  # Prevent accidental reset
                )
            )
            logger.info(f"ChromaDB client initialized (path: {persist_dir})")
        except Exception as e:
            logger.error(f"ChromaDB initialization error: {e}")
            raise
        
        # Get or create collection with cosine similarity
        try:
            self.collection = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}  # Cosine similarity for embeddings
            )
            logger.info(f"Collection '{collection_name}' loaded ({self.count()} documents)")
        except Exception as e:
            logger.error(f"Collection initialization error: {e}")
            raise

    def add(
        self, 
        ids: List[str], 
        documents: List[str], 
        metadatas: List[Dict[str, Any]], 
        embeddings: List[List[float]]
    ):
        """
        Add documents to the collection
        
        Args:
            ids: Document IDs
            documents: Document texts
            metadatas: Document metadata
            embeddings: Document embeddings
        """
        try:
            self.collection.add(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
                embeddings=embeddings
            )
            logger.info(f"Added {len(ids)} documents to collection")
        except Exception as e:
            logger.error(f"Error adding documents: {e}")
            raise

    def query(
        self, 
        query_embeddings: List[List[float]], 
        n_results: int = 5,
        where: Optional[Dict[str, Any]] = None,
        specialty: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Query the collection for similar documents with specialty filtering
        
        Args:
            query_embeddings: Query embeddings
            n_results: Number of results to return
            where: Metadata filters (optional)
            specialty: Filter by medical specialty (e.g., "cardiology")
        
        Returns:
            Query results with documents, metadatas, and distances
        """
        try:
            # Build where filter with specialty
            if specialty:
                specialty_filter = {"specialty": specialty.lower().strip()}
                if where:
                    # Combine filters (AND logic)
                    where = {"$and": [where, specialty_filter]}
                else:
                    where = specialty_filter
            
            # Ultra-fast query for low latency
            optimized_n_results = min(n_results, 3)  # Max 3 results for speed
            
            result = self.collection.query(
                query_embeddings=query_embeddings,
                n_results=optimized_n_results,
                include=["documents", "metadatas", "distances"],
                where=where
            )
            return result
        except Exception as e:
            logger.error(f"Query error: {e}")
            return {"documents": [[]], "metadatas": [[]], "distances": [[]]}

    def count(self) -> int:
        """Get the number of documents in the collection"""
        try:
            return self.collection.count()
        except Exception as e:
            logger.error(f"Count error: {e}")
            return 0
    
    def get_stats(self) -> dict:
        """Get collection statistics"""
        try:
            return {
                "name": self.collection.name,
                "count": self.count(),
                "metadata": self.collection.metadata
            }
        except Exception as e:
            logger.error(f"Stats error: {e}")
            return {}
    
    def delete(self, ids: List[str]):
        """Delete documents by IDs"""
        try:
            self.collection.delete(ids=ids)
            logger.info(f"Deleted {len(ids)} documents")
        except Exception as e:
            logger.error(f"Delete error: {e}")
            raise
    
    def update(
        self,
        ids: List[str],
        documents: Optional[List[str]] = None,
        metadatas: Optional[List[Dict[str, Any]]] = None,
        embeddings: Optional[List[List[float]]] = None
    ):
        """Update documents in the collection"""
        try:
            self.collection.update(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
                embeddings=embeddings
            )
            logger.info(f"Updated {len(ids)} documents")
        except Exception as e:
            logger.error(f"Update error: {e}")
            raise
