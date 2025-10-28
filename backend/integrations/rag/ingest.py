"""
RAG Ingestion - Production Grade with PDF Support
Multi-specialty medical book ingestion with PyPDFLoader, advanced chunking, and OpenAI embeddings
Optimized for low-latency retrieval with specialty-based filtering
"""

import io
import logging
import time
import hashlib
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any
from openai import OpenAI
from config import settings

# PDF and text processing
try:
    from langchain_community.document_loaders import PyPDFLoader
except ImportError:
    raise ImportError("Install: pip install langchain-community pypdf")

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    raise ImportError("Install: pip install langchain-text-splitters")

from .vector_store import VectorStore

logger = logging.getLogger(__name__)


def clean_pdf_text(text: str) -> str:
    """
    Clean extracted PDF text by normalizing whitespace and newlines
    
    PDFs often have hard line breaks that don't represent actual paragraph breaks.
    This function:
    - Replaces single \n with space (joins broken lines)
    - Preserves \n\n (paragraph breaks)
    - Removes excessive whitespace
    - Preserves sentence structure
    
    Args:
        text: Raw text from PDF
    
    Returns:
        Cleaned text with normalized whitespace
    """
    if not text:
        return ""
    
    # Step 1: Preserve paragraph breaks by replacing \n\n with a placeholder
    text = text.replace('\n\n', '<!PARAGRAPH!>')
    
    # Step 2: Replace single \n with space (joins broken lines)
    text = text.replace('\n', ' ')
    
    # Step 3: Restore paragraph breaks
    text = text.replace('<!PARAGRAPH!>', '\n\n')
    
    # Step 4: Remove excessive spaces (multiple spaces -> single space)
    import re
    text = re.sub(r' +', ' ', text)
    
    # Step 5: Clean up spaces around paragraph breaks
    text = re.sub(r' *\n\n *', '\n\n', text)
    
    # Step 6: Remove leading/trailing whitespace
    text = text.strip()
    
    return text


class SpecialtyPDFIngestion:
    """Production-grade PDF ingestion with specialty metadata and batch processing"""
    
    def __init__(
        self,
        collection_name: str = "medical_books",
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        batch_size: int = 50
    ):
        """
        Initialize PDF ingestion system
        
        Args:
            collection_name: ChromaDB collection name
            chunk_size: Characters per chunk (1000 for better context)
            chunk_overlap: Overlap between chunks (200 for continuity)
            batch_size: Embeddings per API batch
        """
        self.collection_name = collection_name
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.batch_size = batch_size
        
        # Initialize OpenAI client
        self.client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=30.0,
            max_retries=2
        )
        
        # Initialize vector store
        self.vs = VectorStore(collection_name=collection_name)
        
        # Initialize text splitter with optimized settings
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]  # Prioritize natural breaks
        )
        
        logger.info(
            f"📚 PDF Ingestion initialized: collection={collection_name}, "
            f"chunk_size={chunk_size}, overlap={chunk_overlap}, batch_size={batch_size}"
        )
    
    def ingest_pdf_file(
        self,
        pdf_bytes: bytes,
        specialty: str,
        book_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Ingest a single PDF file with specialty metadata
        
        Args:
            pdf_bytes: PDF file bytes
            specialty: Medical specialty (e.g., "cardiology", "neurology")
            book_name: Optional book name for tracking
            metadata: Additional metadata to attach
        
        Returns:
            Ingestion statistics
        """
        start_time = time.time()
        specialty = specialty.lower().strip()
        
        logger.info(f"📖 Ingesting PDF for specialty: {specialty}")
        
        try:
            # Save PDF temporarily for PyPDFLoader
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
                tmp_file.write(pdf_bytes)
                tmp_path = tmp_file.name
            
            try:
                # Load PDF with PyPDFLoader
                loader = PyPDFLoader(tmp_path)
                documents = loader.load()
                logger.info(f"  ✓ Loaded {len(documents)} pages from PDF")
                
                # Clean PDF text (remove excessive newlines)
                for doc in documents:
                    doc.page_content = clean_pdf_text(doc.page_content)
                
                # Add specialty and custom metadata to all documents
                for doc in documents:
                    doc.metadata['specialty'] = specialty
                    if book_name:
                        doc.metadata['book_name'] = book_name
                    if metadata:
                        doc.metadata.update(metadata)
                
                # Split documents into optimized chunks
                chunks = self.text_splitter.split_documents(documents)
                logger.info(f"  ✓ Split into {len(chunks)} chunks (size={self.chunk_size}, overlap={self.chunk_overlap})")
                
                if not chunks:
                    logger.warning("No chunks generated from PDF")
                    return {"status": "error", "message": "No content extracted"}
                
                # Generate embeddings and ingest
                result = self._embed_and_store(chunks, specialty)
                
                total_time = time.time() - start_time
                result['ingestion_time_seconds'] = round(total_time, 2)
                result['specialty'] = specialty
                result['book_name'] = book_name
                
                logger.info(f"✅ Ingestion complete: {result['chunks_added']} chunks in {total_time:.1f}s")
                
                return result
                
            finally:
                # Clean up temp file
                import os
                try:
                    os.unlink(tmp_path)
                except:
                    pass
                    
        except Exception as e:
            logger.error(f"❌ PDF ingestion failed: {e}", exc_info=True)
            return {
                "status": "error",
                "message": str(e),
                "specialty": specialty
            }
    
    def ingest_pdf_directory(
        self,
        pdf_directory: str,
        specialty: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Ingest all PDFs from a directory for a specific specialty
        
        Args:
            pdf_directory: Path to directory containing PDFs
            specialty: Medical specialty for all PDFs in this directory
            metadata: Additional metadata
        
        Returns:
            Ingestion statistics
        """
        start_time = time.time()
        specialty = specialty.lower().strip()
        
        pdf_dir = Path(pdf_directory)
        if not pdf_dir.exists():
            raise FileNotFoundError(f"Directory not found: {pdf_directory}")
        
        # Find all PDFs recursively
        pdf_files = list(pdf_dir.glob("**/*.pdf"))
        logger.info(f"📚 Found {len(pdf_files)} PDF files in {pdf_directory}")
        
        if not pdf_files:
            return {
                "status": "success",
                "pdfs_processed": 0,
                "total_chunks": 0,
                "message": "No PDF files found"
            }
        
        all_documents = []
        processed_files = 0
        failed_files = []
        
        # Load all PDFs
        for pdf_file in pdf_files:
            try:
                logger.info(f"\n  Processing: {pdf_file.name}")
                loader = PyPDFLoader(str(pdf_file))
                documents = loader.load()
                
                # Clean PDF text (remove excessive newlines)
                for doc in documents:
                    doc.page_content = clean_pdf_text(doc.page_content)
                
                # Add metadata
                for doc in documents:
                    doc.metadata['specialty'] = specialty
                    doc.metadata['source_file'] = pdf_file.name
                    if metadata:
                        doc.metadata.update(metadata)
                
                all_documents.extend(documents)
                processed_files += 1
                logger.info(f"    ✓ Loaded {len(documents)} pages")
                
            except Exception as e:
                logger.error(f"    ✗ Error loading {pdf_file.name}: {e}")
                failed_files.append(pdf_file.name)
        
        if not all_documents:
            return {
                "status": "error",
                "message": "No documents loaded successfully",
                "failed_files": failed_files
            }
        
        logger.info(f"\n✓ Total pages loaded: {len(all_documents)}")
        
        # Split into chunks
        chunks = self.text_splitter.split_documents(all_documents)
        logger.info(f"✓ Split into {len(chunks)} chunks")
        
        # Embed and store
        result = self._embed_and_store(chunks, specialty)
        
        total_time = time.time() - start_time
        result['pdfs_processed'] = processed_files
        result['total_pdfs_found'] = len(pdf_files)
        result['failed_files'] = failed_files
        result['ingestion_time_seconds'] = round(total_time, 2)
        result['specialty'] = specialty
        
        logger.info(f"\n✅ Directory ingestion complete: {processed_files} PDFs, {result['chunks_added']} chunks in {total_time:.1f}s")
        
        return result
    
    def _embed_and_store(self, chunks: List[Any], specialty: str) -> Dict[str, Any]:
        """
        Generate embeddings and store chunks with batch processing
        
        Args:
            chunks: List of LangChain document chunks
            specialty: Medical specialty
        
        Returns:
            Storage statistics
        """
        if not chunks:
            return {"status": "error", "message": "No chunks to embed"}
        
        try:
            # Extract texts for embedding
            texts = [chunk.page_content for chunk in chunks]
            
            # Generate embeddings in batches
            all_embeddings = []
            total_batches = (len(texts) + self.batch_size - 1) // self.batch_size
            
            logger.info(f"🔄 Generating embeddings in {total_batches} batches...")
            
            for i in range(0, len(texts), self.batch_size):
                batch_num = i // self.batch_size + 1
                batch_texts = texts[i:i + self.batch_size]
                
                try:
                    batch_start = time.time()
                    
                    response = self.client.embeddings.create(
                        model="text-embedding-3-small",
                        input=batch_texts
                    )
                    
                    batch_embeddings = [item.embedding for item in response.data]
                    all_embeddings.extend(batch_embeddings)
                    
                    batch_time = time.time() - batch_start
                    logger.info(f"  Batch {batch_num}/{total_batches}: {len(batch_texts)} chunks ({int(batch_time*1000)}ms)")
                    
                except Exception as e:
                    logger.error(f"  ❌ Batch {batch_num} failed: {e}")
                    raise
            
            # Prepare data for vector store
            ids = []
            documents = []
            metadatas = []
            
            for idx, (chunk, embedding) in enumerate(zip(chunks, all_embeddings)):
                # Generate unique ID with specialty prefix
                chunk_hash = hashlib.md5(chunk.page_content.encode()).hexdigest()[:8]
                doc_id = f"{specialty}_{idx}_{chunk_hash}"
                
                ids.append(doc_id)
                documents.append(chunk.page_content)
                
                # Ensure specialty is in metadata
                metadata = dict(chunk.metadata)
                metadata['specialty'] = specialty
                metadatas.append(metadata)
        
        # Add to vector store
            logger.info(f"💾 Adding {len(ids)} chunks to vector store...")
            self.vs.add(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
                embeddings=all_embeddings
            )
            
            return {
                "status": "success",
                "chunks_added": len(ids),
                "total_documents": self.vs.count(),
                "embedding_model": "text-embedding-3-small"
            }
            
        except Exception as e:
            logger.error(f"❌ Embedding/storage failed: {e}", exc_info=True)
            raise
    
    def get_stats(self) -> Dict[str, Any]:
        """Get ingestion statistics"""
        try:
            stats = self.vs.get_stats()
            
            # Get specialty breakdown
            # Note: This requires querying all documents - expensive for large collections
            # Consider maintaining separate counters if needed frequently
            
            return {
                "collection_name": stats.get("name"),
                "total_chunks": stats.get("count"),
                "chunk_size": self.chunk_size,
                "chunk_overlap": self.chunk_overlap,
                "status": "healthy" if stats.get("count", 0) > 0 else "empty"
            }
        except Exception as e:
            logger.error(f"❌ Error getting stats: {e}")
            return {"status": "error", "error": str(e)}


# Singleton instance
_ingestion_service = None

def get_ingestion_service() -> SpecialtyPDFIngestion:
    """Get or create singleton ingestion service"""
    global _ingestion_service
    if _ingestion_service is None:
        _ingestion_service = SpecialtyPDFIngestion()
    return _ingestion_service


# Convenience functions for API routes
def ingest_pdf_file(
    pdf_bytes: bytes,
    specialty: str,
    book_name: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Ingest a single PDF file
    
    Args:
        pdf_bytes: PDF file bytes
        specialty: Medical specialty (e.g., "cardiology")
        book_name: Optional book name
        metadata: Additional metadata
    
    Returns:
        Ingestion result
    """
    service = get_ingestion_service()
    return service.ingest_pdf_file(pdf_bytes, specialty, book_name, metadata)


def ingest_pdf_directory(
    pdf_directory: str,
    specialty: str,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Ingest all PDFs from a directory
    
    Args:
        pdf_directory: Directory path
        specialty: Medical specialty
        metadata: Additional metadata
    
    Returns:
        Ingestion result
    """
    service = get_ingestion_service()
    return service.ingest_pdf_directory(pdf_directory, specialty, metadata)


def get_ingestion_stats() -> Dict[str, Any]:
    """Get ingestion statistics"""
    service = get_ingestion_service()
    return service.get_stats()


def clear_collection(collection_name: str = "medical_books") -> bool:
    """
    Clear all documents from collection (use with caution!)
    
    Args:
        collection_name: Collection to clear
    
    Returns:
        Success status
    """
    try:
        vs = VectorStore(collection_name=collection_name)
        count = vs.count()
        
        if count == 0:
            logger.info("⚠️ Collection is already empty")
            return True
        
        logger.warning(f"🗑️ Clearing {count} chunks from '{collection_name}'...")
        vs.client.delete_collection(name=collection_name)
        logger.info(f"✅ Collection '{collection_name}' cleared")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error clearing collection: {e}")
        return False


def clear_specialty(specialty: str, collection_name: str = "medical_books") -> Dict[str, Any]:
    """
    Clear all documents for a specific specialty
    
    Args:
        specialty: Specialty to clear
        collection_name: Collection name
    
    Returns:
        Result with count of deleted chunks
    """
    try:
        vs = VectorStore(collection_name=collection_name)
        specialty = specialty.lower().strip()
        
        # Get all IDs for this specialty
        # Note: ChromaDB doesn't have efficient "get by metadata" for deletion
        # So we need to get all documents and filter
        logger.warning(f"🗑️ Clearing all chunks for specialty: {specialty}")
        
        # This is a workaround - in production, consider maintaining specialty-specific collections
        # For now, we'll use where filter to get matching IDs
        result = vs.collection.get(
            where={"specialty": specialty},
            include=["metadatas"]
        )
        
        if result and result.get("ids"):
            ids_to_delete = result["ids"]
            vs.delete(ids_to_delete)
            logger.info(f"✅ Deleted {len(ids_to_delete)} chunks for specialty: {specialty}")
            return {
                "status": "success",
                "specialty": specialty,
                "chunks_deleted": len(ids_to_delete)
            }
        else:
            logger.info(f"⚠️ No chunks found for specialty: {specialty}")
            return {
                "status": "success",
                "specialty": specialty,
                "chunks_deleted": 0
            }
        
    except Exception as e:
        logger.error(f"❌ Error clearing specialty: {e}")
        return {
            "status": "error",
            "error": str(e)
        }
