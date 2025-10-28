"""
RAG Integration Module - Production Grade
Multi-specialty medical knowledge base with PDF ingestion and ultra-low latency retrieval
"""

from .service import RAGService
from .retriever import RAGRetriever
from .vector_store import VectorStore
from .ingest import (
    ingest_pdf_file,
    ingest_pdf_directory,
    get_ingestion_stats,
    clear_collection,
    clear_specialty,
    SpecialtyPDFIngestion
)

__all__ = [
    'RAGService',
    'RAGRetriever',
    'VectorStore',
    'ingest_pdf_file',
    'ingest_pdf_directory',
    'get_ingestion_stats',
    'clear_collection',
    'clear_specialty',
    'SpecialtyPDFIngestion'
]
