"""
Pipecat WebSocket Streaming Endpoint
High-performance streaming conversation with optimized latency
"""

import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from integrations.pipecat_core import (
    PipecatPipelineBuilder,
    PipelineConfig,
    AuthenticatedWebSocketTransport
)
from database.database import get_db, AsyncSessionLocal
from service.consultation_service import open_session, get_consultation_details

logger = logging.getLogger(__name__)
router = APIRouter()

# Global pipeline manager to track active sessions
from integrations.pipecat_core.pipeline import PipelineManager
pipeline_manager = PipelineManager()


@router.websocket("/pipecat/conversation/stream")
async def pipecat_streaming_conversation(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None),
    consultation_id: Optional[int] = Query(None),
    language: Optional[str] = Query("en"),
    provider: Optional[str] = Query("deepgram"),
    multilingual: Optional[bool] = Query(False),
    use_rag: Optional[bool] = Query(True)
):
    """
    Pipecat-powered streaming conversation endpoint
    
    Features:
    - Ultra-low latency (<2s total, <800ms time-to-first-audio)
    - Streaming STT → LLM → TTS pipeline
    - Real-time analytics logging
    - JWT authentication
    - RAG integration
    - Multi-language support
    
    Args:
        websocket: WebSocket connection
        token: JWT authentication token
        session_id: Optional session ID for conversation continuity
        consultation_id: Database consultation ID for analytics
        language: Language code (e.g., "en", "hi", "multi")
        provider: Service provider ("deepgram" or "sarvam")
        multilingual: Enable multilingual mode
        use_rag: Enable RAG context injection
    """
    
    # Accept WebSocket first, then authenticate
    logger.info(f"🔌 New Pipecat WebSocket connection attempt")
    
    try:
        # Accept the WebSocket connection first
        await websocket.accept()
        logger.info("✅ WebSocket accepted")
        
        # Then authenticate
        user_data = await AuthenticatedWebSocketTransport.authenticate_after_accept(token)
        logger.info(f"✅ Pipecat authenticated for user: {user_data.get('username', 'unknown')}")
    except Exception as e:
        logger.error(f"❌ Pipecat authentication failed: {e}", exc_info=True)
        try:
            await websocket.close(code=1008, reason=str(e))
        except:
            pass
        return
    
    # Generate session ID if not provided
    if not session_id:
        import time
        session_id = f"pipecat-{int(time.time())}"
    
    # Initialize session data
    session_db_id = None
    doctor_id = None
    patient_id = None
    hospital_id = None
    system_prompt = None
    
    try:
        logger.info(f"📋 Configuration: consultation_id={consultation_id}, provider={provider}, language={language}, multilingual={multilingual}, use_rag={use_rag}")
        
        # Open database session if consultation_id provided
        if consultation_id:
            async with AsyncSessionLocal() as db:
                try:
                    # Create database session
                    session_db_id = await open_session(
                        db,
                        consultation_id=consultation_id,
                        session_type="pipecat_streaming"
                    )
                    logger.info(f"Database session created: session_db_id={session_db_id}")
                    
                    # Get consultation details for analytics
                    consultation = await get_consultation_details(db, consultation_id=consultation_id)
                    if consultation:
                        doctor_id = consultation.doctor_id
                        patient_id = consultation.patient_id
                        hospital_id = consultation.hospital_id
                        
                        # Get dynamic system prompt
                        try:
                            from system_prompt import get_dynamic_system_prompt
                            system_prompt = await get_dynamic_system_prompt(
                                db,
                                doctor_id,
                                consultation_id
                            )
                            logger.info(f"Using dynamic system prompt for doctor_id={doctor_id}")
                        except Exception as e:
                            logger.warning(f"Failed to get dynamic system prompt: {e}")
                            from system_prompt import VIRTUAL_DOCTOR_SYSTEM_PROMPT
                            system_prompt = VIRTUAL_DOCTOR_SYSTEM_PROMPT
                    
                except Exception as e:
                    logger.warning(f"Failed to create database session: {e}")
        
        # Determine language code for services
        lang_code = language or "en"
        
        # Determine TTS voice and language
        tts_voice = "aura-asteria-en"
        tts_language = "en-IN"
        tts_speaker = "karun"
        
        if lang_code in ["hi", "hi-IN", "hin"]:
            tts_voice = "aura-2-thalia-en"  # Deepgram Hindi voice
            tts_language = "hi-IN"
            tts_speaker = "karun"  # Sarvam Hindi speaker
        
        # Build pipeline configuration
        config = PipelineConfig(
            # STT Configuration
            stt_provider=provider,
            stt_language=lang_code,
            stt_multilingual=multilingual,
            
            # LLM Configuration
            llm_system_prompt=system_prompt,
            llm_use_rag=use_rag,
            
            # TTS Configuration
            tts_provider=provider,
            tts_voice=tts_voice,
            tts_language=tts_language,
            tts_speaker=tts_speaker,
            
            # Analytics Configuration
            consultation_id=consultation_id,
            session_db_id=session_db_id,
            doctor_id=doctor_id,
            patient_id=patient_id,
            hospital_id=hospital_id,
            enable_analytics=True
        )
        
        # Send connection confirmation
        await websocket.send_json({
            "type": "connection_established",
            "message": "Pipecat streaming ready",
            "session_id": session_id,
            "session_db_id": session_db_id,
            "consultation_id": consultation_id,
            "latency_mode": "ultra_low",
            "pipeline": "STT → LLM+RAG → TTS"
        })
        logger.info(f"✅ Connection confirmation sent for session {session_id}")
        
        # Create authenticated transport (WebSocket already accepted)
        transport = AuthenticatedWebSocketTransport(
            websocket=websocket,
            authenticated_user=user_data
        )
        # Don't call transport.start() - WebSocket is already accepted
        
        # Create and run pipeline
        logger.info(f"🚀 Starting Pipecat pipeline for session {session_id}")
        
        try:
            # Create pipeline
            logger.info(f"📦 Creating pipeline with config: provider={provider}, language={lang_code}, rag={use_rag}")
            pipeline, builder = await pipeline_manager.create_pipeline(
                session_id=session_id,
                config=config,
                transport=transport
            )
            logger.info(f"✅ Pipeline created, starting execution")
            
            # Run pipeline with PipelineTask (properly starts all processors)
            await builder.run_pipeline_with_task(pipeline, transport)
            
            logger.info(f"✅ Pipecat pipeline completed for session {session_id}")
        
        except asyncio.CancelledError:
            logger.info(f"⚠️ Pipecat pipeline cancelled for session {session_id}")
        
        except Exception as e:
            logger.error(f"❌ Pipecat pipeline error for session {session_id}: {e}", exc_info=True)
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Pipeline error: {str(e)}"
                })
            except:
                pass
        
        finally:
            # Clean up pipeline
            await pipeline_manager.stop_pipeline(session_id)
    
    except WebSocketDisconnect:
        logger.info(f"Pipecat WebSocket disconnected: session {session_id}")
    
    except Exception as e:
        logger.error(f"Pipecat WebSocket error: {e}")
    
    finally:
        # Ensure pipeline is stopped
        try:
            await pipeline_manager.stop_pipeline(session_id)
        except:
            pass


@router.get("/pipecat/status")
async def pipecat_status():
    """
    Get status of Pipecat integration
    Shows active pipelines and system health
    """
    return {
        "status": "operational",
        "active_pipelines": pipeline_manager.get_pipeline_count(),
        "active_sessions": pipeline_manager.get_active_sessions(),
        "features": {
            "streaming_stt": True,
            "streaming_llm": True,
            "streaming_tts": True,
            "rag_integration": True,
            "analytics": True,
            "multi_language": True,
            "authentication": True
        },
        "performance": {
            "expected_latency": "1.5-3s total",
            "time_to_first_audio": "<800ms",
            "optimization": "frame-based streaming"
        }
    }


@router.get("/pipecat/metrics")
async def pipecat_metrics():
    """
    Get real-time metrics for Pipecat pipelines
    Shows performance and usage statistics
    """
    return {
        "status": "success",
        "metrics": {
            "active_pipelines": pipeline_manager.get_pipeline_count(),
            "active_sessions": pipeline_manager.get_active_sessions(),
            "total_processed": "tracked in analytics",
            "average_latency": "tracked in analytics",
            "error_rate": "tracked in analytics"
        },
        "note": "Detailed metrics available in analytics endpoints"
    }


@router.get("/pipecat/conversation", response_class=HTMLResponse)
async def pipecat_conversation_page():
    """
    Serve the Pipecat conversation interface (full conversation UI)
    Matches the style of /conversation but with Pipecat ultra-low latency
    """
    try:
        with open("templates/pipecat_conversation.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        logger.error(f"Error serving Pipecat conversation page: {e}")
        raise HTTPException(status_code=500, detail=str(e))

