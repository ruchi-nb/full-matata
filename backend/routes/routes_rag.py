"""
RAG Routes - Production Grade with Specialty Support
API endpoints for PDF ingestion, RAG retrieval, and answer generation
Supports multi-specialty medical knowledge base with filtering
"""

from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Depends, Query
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
import time
import logging

from integrations.rag.service import RAGService
from integrations.rag.ingest import (
    ingest_pdf_file, 
    ingest_pdf_directory,
    get_ingestion_stats,
    clear_collection,
    clear_specialty
)
from database.database import get_db
from dependencies.dependencies import require_permissions

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize RAG service (singleton)
rag_service = RAGService()


@router.post("/rag/ingest-pdf")
async def rag_ingest_pdf(
    file: UploadFile = File(...),
    specialty: str = Form(...),
    book_name: Optional[str] = Form(None),
    caller: Dict[str, Any] = Depends(require_permissions(["rag.ingest"], allow_super_admin=True))
):
    """
    Ingest a PDF file for a specific medical specialty
    
    Args:
        file: PDF file upload
        specialty: Medical specialty (e.g., "cardiology", "neurology")
        book_name: Optional book name for tracking
    
    Returns:
        Ingestion statistics
    """
    try:
        # Validate file type
        if not file.filename.endswith('.pdf'):
            raise HTTPException(
                status_code=400, 
                detail="Only PDF files are supported"
            )
        
        # Read file content
        content = await file.read()
        
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty PDF file")
        
        logger.info(f"📚 Ingesting PDF: {file.filename} for specialty: {specialty}")
        
        # Ingest PDF
        result = ingest_pdf_file(
            pdf_bytes=content,
            specialty=specialty,
            book_name=book_name or file.filename
        )
        
        if result.get("status") == "error":
            raise HTTPException(
                status_code=500,
                detail=result.get("message", "Ingestion failed")
            )
        
        return {
            "status": "success",
            "filename": file.filename,
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF ingestion error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rag/ingest-directory")
async def rag_ingest_directory(
    directory: str = Form(...),
    specialty: str = Form(...),
    caller: Dict[str, Any] = Depends(require_permissions(["rag.ingest"], allow_super_admin=True))
):
    """
    Ingest all PDFs from a directory for a specific specialty
    
    Args:
        directory: Directory path containing PDFs
        specialty: Medical specialty for all PDFs
    
    Returns:
        Ingestion statistics
    """
    try:
        logger.info(f"📚 Ingesting directory: {directory} for specialty: {specialty}")
        
        result = ingest_pdf_directory(
            pdf_directory=directory,
            specialty=specialty
        )
        
        if result.get("status") == "error":
            raise HTTPException(
                status_code=500,
                detail=result.get("message", "Directory ingestion failed")
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Directory ingestion error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rag/search")
async def rag_search(
    query: str = Query(..., description="Search query"),
    specialty: Optional[str] = Query(None, description="Filter by medical specialty"),
    k: int = Query(5, ge=1, le=10, description="Number of results")
):
    """
    Search RAG knowledge base with optional specialty filtering
    
    Args:
        query: Search query
        specialty: Optional specialty filter (e.g., "cardiology")
        k: Number of results to return
    
    Returns:
        Search results with citations and relevance scores
    """
    try:
        result = rag_service.retriever.retrieve_with_sources(
            query=query,
            k=k,
            specialty=specialty,
            min_relevance=0.2
        )
        
        return {
            "status": "success",
            "query": query,
            "specialty": specialty,
            **result
        }
        
    except Exception as e:
        logger.error(f"RAG search error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rag/answer")
async def rag_answer(
    text: str = Form(...),
    specialty: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    consultation_id: Optional[int] = Form(None),
    session_db_id: Optional[int] = Form(None),
    include_sources: bool = Form(True),
    caller: Dict[str, Any] = Depends(require_permissions(["rag.answer"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate RAG-enhanced answer with specialty filtering
    
    Args:
        text: User query
        specialty: Optional specialty filter for context retrieval
        session_id: Session identifier
        consultation_id: Consultation ID for logging
        session_db_id: Session DB ID for logging
        include_sources: Include source citations
    
    Returns:
        Answer with citations, sources, and metrics
    """
    request_id = f"req-{int(time.time()*1000)}"
    if not session_id:
        session_id = f"rag-{int(time.time())}"
    
    start = time.time()
    
    try:
        logger.info(
            f"RAG Answer request: query='{text[:50]}...', "
            f"specialty={specialty}, session={session_id}"
        )
        
        # Generate answer with specialty filter
        result = rag_service.answer(
            query=text,
            specialty=specialty,
            include_sources=include_sources
        )
        
        answer = result.get("answer", "")
        sources = result.get("sources", [])
        citations = result.get("citations", [])
        confidence = result.get("confidence", 0.0)
        metrics = result.get("metrics", {})
        
        latency_ms = int((time.time() - start) * 1000)
        
        # Log to database if consultation context provided
        if consultation_id and session_db_id:
            try:
                from service.analytics_service import log_rag_retrieval
                from service.consultation_service import append_message, get_consultation_details
                
                # Get consultation details
                consultation = await get_consultation_details(db, consultation_id=consultation_id)
                
                if consultation:
                    # Log RAG retrieval with specialty
                    await log_rag_retrieval(
                        db=db,
                        context_length=metrics.get("context_chars", 0),
                        response_time_ms=latency_ms,
                        session_id=session_db_id,
                        doctor_id=consultation.doctor_id,
                        patient_id=consultation.patient_id,
                        hospital_id=consultation.hospital_id
                    )
                    
                    # Log user message
                    await append_message(
                        db,
                        session_id=session_db_id,
                        sender_type="patient",
                        message_text=text,
                        audio_url=None,
                        processing_time_ms=latency_ms
                    )
                    
                    # Log assistant response with sources
                    response_text = answer
                    if citations:
                        response_text += "\n\nSources:\n" + "\n".join(citations)
                    
                    await append_message(
                        db,
                        session_id=session_db_id,
                        sender_type="assistant",
                        message_text=response_text,
                        audio_url=None,
                        processing_time_ms=latency_ms
                    )
                    
                    logger.info(f"RAG answer logged to database (session={session_db_id})")
                    
            except Exception as e:
                logger.error(f"RAG database logging failed: {e}", exc_info=True)
        
        return {
            "status": "success",
            "response": answer,
            "citations": citations if include_sources else [],
            "sources": sources if include_sources else [],
            "confidence": confidence,
            "specialty": specialty,
            "metrics": {
                "request_id": request_id,
                "session_id": session_id,
                "latency_ms": latency_ms,
                "chunks_used": metrics.get("chunks_used", 0),
                "context_chars": metrics.get("context_chars", 0)
            }
        }
        
    except Exception as e:
        logger.error(f"RAG answer error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rag/stats")
async def rag_stats(
    caller: Dict[str, Any] = Depends(require_permissions(["rag.view"], allow_super_admin=True))
):
    """Get RAG system statistics"""
    try:
        ingestion_stats = get_ingestion_stats()
        service_stats = rag_service.get_stats()
        
        return {
            "status": "success",
            "ingestion": ingestion_stats,
            "service": service_stats
        }
        
    except Exception as e:
        logger.error(f"RAG stats error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rag/history")
async def rag_history(
    limit: int = Query(10, ge=1, le=100),
    caller: Dict[str, Any] = Depends(require_permissions(["rag.view"], allow_super_admin=True))
):
    """Get recent query history"""
    try:
        history = rag_service.get_history(limit=limit)
        return {
            "status": "success",
            "history": history,
            "count": len(history)
        }
        
    except Exception as e:
        logger.error(f"RAG history error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/rag/clear")
async def rag_clear(
    collection: bool = Query(False, description="Clear entire collection"),
    specialty: Optional[str] = Query(None, description="Clear specific specialty"),
    cache: bool = Query(False, description="Clear caches"),
    caller: Dict[str, Any] = Depends(require_permissions(["rag.admin"], allow_super_admin=True))
):
    """
    Clear RAG data (use with caution!)
    
    Args:
        collection: Clear entire collection
        specialty: Clear specific specialty only
        cache: Clear caches
    
    Returns:
        Clear operation result
    """
    try:
        results = {}
        
        if collection:
            success = clear_collection()
            results["collection_cleared"] = success
            logger.warning("⚠️ RAG collection cleared!")
        
        if specialty:
            result = clear_specialty(specialty)
            results["specialty_cleared"] = result
            logger.warning(f"⚠️ Specialty '{specialty}' cleared!")
        
        if cache:
            rag_service.retriever.clear_cache()
            rag_service.clear_history()
            results["cache_cleared"] = True
            logger.info("RAG caches cleared")
        
        return {
            "status": "success",
            **results
        }
        
    except Exception as e:
        logger.error(f"RAG clear error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rag/warm-cache")
async def rag_warm_cache(
    queries: list = Form(...),
    specialty: Optional[str] = Form(None),
    caller: Dict[str, Any] = Depends(require_permissions(["rag.admin"], allow_super_admin=True))
):
    """
    Warm up embedding cache with common queries
    
    Args:
        queries: List of common queries
        specialty: Optional specialty filter
    
    Returns:
        Cache warming result
    """
    try:
        rag_service.retriever.warm_cache(queries, specialty=specialty)
        stats = rag_service.retriever.get_cache_stats()
        
        return {
            "status": "success",
            "queries_processed": len(queries),
            "specialty": specialty,
            "cache_stats": stats
        }
        
    except Exception as e:
        logger.error(f"Cache warming error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
