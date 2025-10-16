"""
RAG Ingestion - Production Grade
Optimized document ingestion with batch processing, progress tracking, and error handling
"""

import json
import logging
import time
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from openai import OpenAI
from config import settings

from .vector_store import VectorStore

logger = logging.getLogger(__name__)


def _split_text(text: str, max_chars: int = 1000) -> List[str]:
    """
    Split text into chunks by word boundaries
    
    Args:
        text: Text to split
        max_chars: Maximum characters per chunk
    
    Returns:
        List of text chunks
    """
    words = text.split()
    chunks: List[str] = []
    cur: List[str] = []
    cur_len = 0
    
    for w in words:
        if cur_len + len(w) + 1 > max_chars and cur:
            chunks.append(" ".join(cur))
            cur = [w]
            cur_len = len(w)
        else:
            cur.append(w)
            cur_len += len(w) + 1
    
    if cur:
        chunks.append(" ".join(cur))
    
    return chunks


def ingest_book(
    book_path: str = "Final_book.json",
    collection: str = "medical_book",
    batch_size: int = 50,
    show_progress: bool = True
) -> int:
    """
    Ingest medical book from JSON file with batch processing
    
    Args:
        book_path: Path to JSON file
        collection: ChromaDB collection name
        batch_size: Number of chunks to process per batch (for embedding API)
        show_progress: Show progress logging
    
    Returns:
        Total number of documents in collection after ingestion
    """
    start_time = time.time()
    
    try:
        # Initialize clients
        client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=30.0,
            max_retries=2
        )
        vs = VectorStore(collection_name=collection)
        
        # Load book data
        path = Path(book_path)
        if not path.exists():
            raise FileNotFoundError(f"Book not found: {book_path}")
        
        logger.info(f"📚 Loading book from: {book_path}")
        
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        
        pages: Dict[str, Dict[str, str]] = data.get("pages", {})
        
        if not pages:
            logger.warning("⚠️ No pages found in book data")
            return vs.count()
        
        logger.info(f"📖 Found {len(pages)} pages to process")
        
        # Collect all chunks first
        all_ids: List[str] = []
        all_docs: List[str] = []
        all_metas: List[Dict] = []
        
        for page_key, page_data in pages.items():
            page_num = page_key.replace("page_", "")
            
            for side in ("left", "right"):
                text = (page_data.get(side) or "").strip()
                if not text:
                    continue
                
                # Treat full side text as a single chunk
                chunk_id = f"{page_num}_{side}"
                all_ids.append(chunk_id)
                all_docs.append(text)
                all_metas.append({"page": page_num, "side": side})
        
        if not all_ids:
            logger.warning("⚠️ No valid text content found in book")
            return vs.count()
        
        logger.info(f"📝 Processing {len(all_ids)} chunks in batches of {batch_size}")
        
        # Process in batches for better performance
        all_embs: List[List[float]] = []
        total_batches = (len(all_docs) + batch_size - 1) // batch_size
        
        for i in range(0, len(all_docs), batch_size):
            batch_num = i // batch_size + 1
            batch_docs = all_docs[i:i + batch_size]
            
            try:
                if show_progress:
                    logger.info(f"⚡ Processing batch {batch_num}/{total_batches} ({len(batch_docs)} chunks)")
                
                batch_start = time.time()
                
                # Generate embeddings for batch
                response = client.embeddings.create(
                    model="text-embedding-3-small",
                    input=batch_docs
                )
                
                batch_time = time.time() - batch_start
                
                # Extract embeddings
                batch_embs = [item.embedding for item in response.data]
                all_embs.extend(batch_embs)
                
                if show_progress:
                    logger.info(f"✅ Batch {batch_num}/{total_batches} complete ({int(batch_time*1000)}ms)")
                
            except Exception as e:
                logger.error(f"❌ Error processing batch {batch_num}: {e}")
                # Continue with next batch instead of failing completely
                # Add zero embeddings as placeholders (will be skipped)
                logger.warning(f"⚠️ Skipping batch {batch_num} due to error")
                continue
        
        # Add all chunks to vector store
        if len(all_embs) == len(all_ids):
            logger.info(f"💾 Adding {len(all_ids)} chunks to vector store...")
            vs.add(ids=all_ids, documents=all_docs, metadatas=all_metas, embeddings=all_embs)
            
            total_time = time.time() - start_time
            logger.info(f"✅ Ingestion complete: {len(all_ids)} chunks in {int(total_time)}s")
        else:
            logger.error(f"❌ Embedding count mismatch: {len(all_embs)} embeddings for {len(all_ids)} chunks")
            logger.warning("⚠️ Some batches may have failed. Ingesting available chunks...")
            
            # Ingest only successfully embedded chunks
            valid_count = min(len(all_embs), len(all_ids))
            if valid_count > 0:
                vs.add(
                    ids=all_ids[:valid_count],
                    documents=all_docs[:valid_count],
                    metadatas=all_metas[:valid_count],
                    embeddings=all_embs[:valid_count]
                )
                logger.info(f"✅ Partial ingestion: {valid_count} chunks added")
        
        final_count = vs.count()
        logger.info(f"📊 Vector store now contains {final_count} documents")
        
        return final_count
        
    except Exception as e:
        logger.error(f"❌ Ingestion failed: {e}", exc_info=True)
        raise


def ingest_book_file(
    file_bytes: bytes,
    collection: str = "medical_book",
    batch_size: int = 50,
    show_progress: bool = True
) -> int:
    """
    Ingest a user-uploaded JSON file with batch processing
    
    Args:
        file_bytes: Raw file bytes
        collection: ChromaDB collection name
        batch_size: Number of chunks to process per batch
        show_progress: Show progress logging
    
    Returns:
        Total number of documents in collection after ingestion
    """
    start_time = time.time()
    
    try:
        # Initialize clients
        client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=30.0,
            max_retries=2
        )
        vs = VectorStore(collection_name=collection)
        
        # Parse JSON
        logger.info("📚 Parsing uploaded file...")
        data = json.loads(file_bytes.decode("utf-8"))
        pages: Dict[str, Dict[str, str]] = data.get("pages", {})
        
        if not pages:
            logger.warning("⚠️ No pages found in uploaded file")
            return vs.count()
        
        logger.info(f"📖 Found {len(pages)} pages to process")
        
        # Collect all chunks
        all_ids: List[str] = []
        all_docs: List[str] = []
        all_metas: List[Dict] = []
        
        for page_key, page_data in pages.items():
            page_num = page_key.replace("page_", "")
            
            for side in ("left", "right"):
                text = (page_data.get(side) or "").strip()
                if not text:
                    continue
                
                chunk_id = f"{page_num}_{side}"
                all_ids.append(chunk_id)
                all_docs.append(text)
                all_metas.append({"page": page_num, "side": side})
        
        if not all_ids:
            logger.warning("⚠️ No valid text content found in file")
            return vs.count()
        
        logger.info(f"📝 Processing {len(all_ids)} chunks in batches of {batch_size}")
        
        # Process in batches
        all_embs: List[List[float]] = []
        total_batches = (len(all_docs) + batch_size - 1) // batch_size
        
        for i in range(0, len(all_docs), batch_size):
            batch_num = i // batch_size + 1
            batch_docs = all_docs[i:i + batch_size]
            
            try:
                if show_progress:
                    logger.info(f"⚡ Processing batch {batch_num}/{total_batches} ({len(batch_docs)} chunks)")
                
                batch_start = time.time()
                
                response = client.embeddings.create(
                    model="text-embedding-3-small",
                    input=batch_docs
                )
                
                batch_time = time.time() - batch_start
                
                batch_embs = [item.embedding for item in response.data]
                all_embs.extend(batch_embs)
                
                if show_progress:
                    logger.info(f"✅ Batch {batch_num}/{total_batches} complete ({int(batch_time*1000)}ms)")
                
            except Exception as e:
                logger.error(f"❌ Error processing batch {batch_num}: {e}")
                logger.warning(f"⚠️ Skipping batch {batch_num} due to error")
                continue
        
        # Add to vector store
        if len(all_embs) == len(all_ids):
            logger.info(f"💾 Adding {len(all_ids)} chunks to vector store...")
            vs.add(ids=all_ids, documents=all_docs, metadatas=all_metas, embeddings=all_embs)
            
            total_time = time.time() - start_time
            logger.info(f"✅ Upload ingestion complete: {len(all_ids)} chunks in {int(total_time)}s")
        else:
            logger.error(f"❌ Embedding count mismatch: {len(all_embs)} embeddings for {len(all_ids)} chunks")
            
            valid_count = min(len(all_embs), len(all_ids))
            if valid_count > 0:
                vs.add(
                    ids=all_ids[:valid_count],
                    documents=all_docs[:valid_count],
                    metadatas=all_metas[:valid_count],
                    embeddings=all_embs[:valid_count]
                )
                logger.info(f"✅ Partial ingestion: {valid_count} chunks added")
        
        final_count = vs.count()
        logger.info(f"📊 Vector store now contains {final_count} documents")
        
        return final_count
        
    except Exception as e:
        logger.error(f"❌ Upload ingestion failed: {e}", exc_info=True)
        raise


def get_ingestion_stats(collection: str = "medical_book") -> Dict[str, any]:
    """
    Get statistics about the ingested data
    
    Args:
        collection: ChromaDB collection name
    
    Returns:
        Dictionary with collection statistics
    """
    try:
        vs = VectorStore(collection_name=collection)
        stats = vs.get_stats()
        
        return {
            "collection_name": stats.get("name"),
            "total_documents": stats.get("count"),
            "metadata": stats.get("metadata"),
            "status": "healthy" if stats.get("count", 0) > 0 else "empty"
        }
    except Exception as e:
        logger.error(f"❌ Error getting ingestion stats: {e}")
        return {
            "collection_name": collection,
            "total_documents": 0,
            "status": "error",
            "error": str(e)
        }


def clear_collection(collection: str = "medical_book") -> bool:
    """
    Clear all documents from a collection (use with caution!)
    
    Args:
        collection: ChromaDB collection name
    
    Returns:
        True if successful, False otherwise
    """
    try:
        vs = VectorStore(collection_name=collection)
        
        # Get all document IDs
        count = vs.count()
        if count == 0:
            logger.info("⚠️ Collection is already empty")
            return True
        
        logger.warning(f"🗑️ Clearing {count} documents from collection '{collection}'...")
        
        # ChromaDB doesn't have a clear_all method, so we need to delete the collection
        # and recreate it
        vs.client.delete_collection(name=collection)
        logger.info(f"✅ Collection '{collection}' cleared")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error clearing collection: {e}")
        return False


def validate_book_file(file_bytes: bytes) -> Tuple[bool, str, Optional[Dict]]:
    """
    Validate a book JSON file before ingestion
    
    Args:
        file_bytes: Raw file bytes
    
    Returns:
        Tuple of (is_valid, message, parsed_data)
    """
    try:
        # Try to parse JSON
        data = json.loads(file_bytes.decode("utf-8"))
        
        # Check for required structure
        if "pages" not in data:
            return False, "Missing 'pages' key in JSON", None
        
        pages = data.get("pages", {})
        if not isinstance(pages, dict):
            return False, "'pages' must be a dictionary", None
        
        if len(pages) == 0:
            return False, "No pages found in file", None
        
        # Count valid chunks
        valid_chunks = 0
        for page_key, page_data in pages.items():
            if not isinstance(page_data, dict):
                continue
            
            for side in ("left", "right"):
                text = (page_data.get(side) or "").strip()
                if text:
                    valid_chunks += 1
        
        if valid_chunks == 0:
            return False, "No valid text content found in pages", None
        
        return True, f"Valid book file: {len(pages)} pages, {valid_chunks} chunks", data
        
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON: {str(e)}", None
    except Exception as e:
        return False, f"Validation error: {str(e)}", None
