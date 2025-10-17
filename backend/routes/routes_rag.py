from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Depends
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
import time
import logging

from integrations.rag.service import RAGService
from integrations.rag.ingest import ingest_book, ingest_book_file
from database.database import get_db
from dependencies.dependencies import require_permissions


logger = logging.getLogger(__name__)
router = APIRouter()
rag_service = RAGService()




@router.post("/rag/ingest-upload")
async def rag_ingest_upload(
    file: UploadFile = File(...),
    caller: Dict[str, Any] = Depends(require_permissions(["rag.ingest"], allow_super_admin=True))
):
    try:
        content = await file.read()
        count = ingest_book_file(content)
        return {"status": "success", "vectors": count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/rag/search")
async def rag_search(
    query: str, 
    k: int = 5
):
    """Search RAG knowledge base - Non-critical endpoint, no auth required"""
    try:
        from integrations.rag.retriever import RAGRetriever
        results = RAGRetriever().retrieve(query, k)
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rag/answer")
async def rag_answer(
    text: str = Form(...), 
    session_id: Optional[str] = Form(None),
    consultation_id: Optional[int] = Form(None),
    session_db_id: Optional[int] = Form(None),
    caller: Dict[str, Any] = Depends(require_permissions(["rag.answer"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    request_id = f"req-{int(time.time()*1000)}"
    if not session_id:
        session_id = f"rag-{int(time.time())}"
    start = time.time()
    
    try:
        answer = rag_service.answer(text)
        latency_ms = int((time.time() - start) * 1000)
        
        # Log to database if consultation context provided
        if consultation_id and session_db_id:
            try:
                from service.analytics_service import log_rag_retrieval
                from service.consultation_service import append_message, close_session, get_consultation_details
                
                # Get consultation details using service layer
                consultation = await get_consultation_details(db, consultation_id=consultation_id)
                
                if consultation:
                    # Log RAG retrieval
                    await log_rag_retrieval(
                        db=db,
                        context_length=len(answer),
                        response_time_ms=latency_ms,
                        session_id=session_db_id,
                        doctor_id=consultation.doctor_id,
                        patient_id=consultation.patient_id,
                        hospital_id=consultation.hospital_id
                    )
                    
                    # Log messages
                    await append_message(
                        db,
                        session_id=session_db_id,
                        sender_type="patient",
                        message_text=text,
                        audio_url=None,
                        processing_time_ms=latency_ms
                    )
                    
                    await append_message(
                        db,
                        session_id=session_db_id,
                        sender_type="assistant",
                        message_text=answer,
                        audio_url=None,
                        processing_time_ms=latency_ms
                    )
                    
                    # DO NOT auto-close session - let it stay open for ongoing conversation
                    # Session will be closed when user explicitly ends the conversation
                    logger.info(f"RAG answer logged to database for session {session_db_id}")
            except Exception as e:
                logger.error(f"RAG database logging failed: {e}")
                import traceback
                logger.error(f"RAG logging traceback: {traceback.format_exc()}")
        
        return {
            "status": "success",
            "response": answer,
            "metrics": {"request_id": request_id, "session_id": session_id, "latency_ms": latency_ms},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


