"""
Comprehensive Analytics Service
Handles all analytics logging, aggregation, and reporting
Maps correctly to database models: ApiUsageLogs, Consultation, ConsultationSessions, etc.
"""

import logging
import asyncio
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, desc, and_, or_, select, case
from sqlalchemy.exc import (
    IntegrityError,
    OperationalError,
    DisconnectionError,
    InvalidRequestError
)

from models.models import (
    ApiUsageLogs, Consultation, ConsultationSessions, ConsultationMessages,
    ConsultationTranscripts, AuditLogs, Specialties, Users, HospitalMaster, RoleMaster
)

from centralisedErrorHandling.ErrorHandling import (
    DatabaseError,
    ConnectionError,
    DataIntegrityError,
    TransactionError
)

logger = logging.getLogger(__name__)


async def _safe_rollback(db: AsyncSession, context: str) -> None:
    """Safely attempt database rollback with error handling"""
    try:
        await db.rollback()
        logger.info(f"Successfully rolled back transaction for {context}")
    except InvalidRequestError as e:
        logger.warning(f"Rollback skipped - no transaction active for {context}: {e}")
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database connection lost during rollback for {context}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during rollback for {context}: {e}", exc_info=True)


# ==========================================
# CORE API USAGE LOGGING
# ==========================================

async def log_api_usage(
    db: AsyncSession,
    *,
    service_type: str,
    response_time_ms: int,
    status: str = "success",
    session_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    hospital_id: Optional[int] = None,
    tokens_used: Optional[int] = None,
    cost: Optional[float] = None,
    api_calls: Optional[int] = None,
) -> None:
    """
    Core API usage logging - single source of truth for all API logging
    Maps to ApiUsageLogs model in database
    """
    try:
        row = ApiUsageLogs(
            service_type=service_type or "unknown",
            response_time_ms=int(response_time_ms or 0),
            status=status or "success",
            session_id=session_id,
            doctor_id=doctor_id,
            patient_id=patient_id,
            hospital_id=hospital_id,
            tokens_used=tokens_used or 0,
            cost=float(cost or 0.0),
            api_calls=api_calls or 1,
        )
        db.add(row)
        
        # Flush explicitly to detect errors early before updating session stats
        try:
            await db.flush()
        except IntegrityError as e:
            await _safe_rollback(db, "api_usage_logs")
            logger.error(f"Integrity error during API usage flush for {service_type}: {e}")
            raise DataIntegrityError(
                f"Foreign key violation while logging {service_type} API usage",
                constraint_type="foreign_key",
                table="api_usage_logs",
                field="session_id" if session_id else "doctor_id/patient_id/hospital_id",
                value=session_id or {"doctor_id": doctor_id, "patient_id": patient_id, "hospital_id": hospital_id},
                original_error=e,
                context={
                    "operation": "log_api_usage_flush",
                    "service_type": service_type,
                    "status": status,
                    "tokens_used": tokens_used,
                    "cost": cost
                }
            )
        except (DisconnectionError, OperationalError) as e:
            await _safe_rollback(db, "api_usage_logs")
            logger.error(f"Connection error during API usage flush for {service_type}: {e}")
            raise ConnectionError(
                f"Database connection failed while logging {service_type} API usage",
                operation="log_api_usage_flush",
                original_error=e,
                context={
                    "table": "api_usage_logs",
                    "service_type": service_type,
                    "session_id": session_id,
                    "response_time_ms": response_time_ms
                }
            )
        except InvalidRequestError as e:
            await _safe_rollback(db, "api_usage_logs")
            logger.error(f"Invalid session state during API usage flush for {service_type}: {e}")
            raise TransactionError(
                f"Session state error while logging {service_type} API usage",
                operation="log_api_usage_flush",
                table="api_usage_logs",
                transaction_state="flush_failed",
                original_error=e,
                context={
                    "service_type": service_type,
                    "session_id": session_id,
                    "tokens_used": tokens_used
                }
            )
        
        # Refresh with explicit exception handling
        try:
            await db.refresh(row)
        except InvalidRequestError as e:
            await _safe_rollback(db, "api_usage_logs")
            logger.error(f"Invalid session state during API usage refresh for {service_type}: {e}")
            raise TransactionError(
                f"Session state error while refreshing {service_type} API usage",
                operation="log_api_usage_refresh",
                table="api_usage_logs",
                transaction_state="refresh_failed",
                original_error=e,
                context={
                    "service_type": service_type,
                    "session_id": session_id,
                    "status": status
                }
            )
        except (DisconnectionError, OperationalError) as e:
            await _safe_rollback(db, "api_usage_logs")
            logger.error(f"Connection error during API usage refresh for {service_type}: {e}")
            raise ConnectionError(
                f"Database connection failed while refreshing {service_type} API usage",
                operation="log_api_usage_refresh",
                original_error=e,
                context={
                    "table": "api_usage_logs",
                    "service_type": service_type,
                    "session_id": session_id
                }
            )
        
        # Update session stats if session_id is provided
        if session_id:
            from service.consultation_service import update_session_stats
            try:
                await update_session_stats(
                    db,
                    session_id=session_id,
                    tokens_used=tokens_used or 0,
                    api_calls=api_calls or 1
                )
            except Exception as e:
                # Log but don't fail the entire operation if session stats update fails
                logger.warning(f"Failed to update session stats for session {session_id}: {e}")
                # Session stats update has its own commit, so we don't need to rollback here
        
        await db.commit()
        logger.info(f"✅ API Usage Logged - ID: {row.usage_id}, Service: {service_type}, Tokens: {tokens_used}, Cost: ${cost}, Latency: {response_time_ms}ms")
    
    except IntegrityError as e:
        await _safe_rollback(db, "api_usage_logs")
        logger.error(f"Integrity error in log_api_usage for {service_type}: {e}")
        raise DataIntegrityError(
            f"Foreign key violation while logging {service_type} API usage",
            constraint_type="foreign_key",
            table="api_usage_logs",
            field="session_id" if session_id else "unknown",
            value=session_id,
            original_error=e
        )
    
    except (DisconnectionError, OperationalError) as e:
        await _safe_rollback(db, "api_usage_logs")
        logger.error(f"Connection error in log_api_usage for {service_type}: {e}")
        raise ConnectionError(
            f"Database connection failed while logging {service_type} API usage",
            operation="log_api_usage",
            original_error=e
        )
    
    except InvalidRequestError as e:
        await _safe_rollback(db, "api_usage_logs")
        logger.error(f"Transaction error in log_api_usage for {service_type}: {e}")
        raise TransactionError(
            f"Transaction error while logging {service_type} API usage",
            operation="commit",
            table="api_usage_logs",
            original_error=e
        )
    
    except Exception as e:
        await _safe_rollback(db, "api_usage_logs")
        logger.error(f"Unexpected error in log_api_usage for {service_type}: {e}", exc_info=True)
        raise DatabaseError(
            f"Unexpected error while logging {service_type} API usage",
            operation="insert",
            table="api_usage_logs",
            original_error=e
        )


# ==========================================
# SERVICE-SPECIFIC LOGGING
# ==========================================

async def log_openai_chat(
    db: AsyncSession,
    *,
    input_tokens: int,
    output_tokens: int,
    response_time_ms: int,
    status: str = "success",
    session_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    hospital_id: Optional[int] = None,
    transcript: str = ""
) -> None:
    """Log OpenAI chat API usage with token and cost calculation"""
    total_tokens = input_tokens + output_tokens
    cost = (input_tokens / 1000 * 0.03) + (output_tokens / 1000 * 0.06)
    
    logger.info(f"🔄 Logging OpenAI chat: tokens={total_tokens}, cost=${cost:.4f}, session_id={session_id}")
    
    # Errors are handled by log_api_usage
    await log_api_usage(
        db,
        service_type="openai_chat",
        response_time_ms=response_time_ms,
        status=status,
        session_id=session_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        hospital_id=hospital_id,
        tokens_used=total_tokens,
        cost=cost,
        api_calls=1
    )
    
    logger.info(f"✅ OpenAI chat logged successfully")


async def log_deepgram_stt(
    db: AsyncSession,
    *,
    audio_duration_sec: float,
    response_time_ms: int,
    transcript: str = "",
    status: str = "success",
    session_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    hospital_id: Optional[int] = None
) -> None:
    """Log Deepgram STT API usage with cost calculation"""
    cost = (audio_duration_sec / 60) * 0.0043
    logger.info(f"🔄 Logging Deepgram STT: duration={audio_duration_sec:.2f}s, cost=${cost:.4f}, session_id={session_id}")
    
    await log_api_usage(
        db,
        service_type="deepgram_stt",
        response_time_ms=response_time_ms,
        status=status,
        session_id=session_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        hospital_id=hospital_id,
        tokens_used=len(transcript.split()) if transcript else 0,
        cost=cost,
        api_calls=1
    )
    
    logger.info(f"✅ Deepgram STT logged successfully")


async def log_deepgram_tts(
    db: AsyncSession,
    *,
    text_length: int,
    audio_size: int,
    response_time_ms: int,
    status: str = "success",
    session_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    hospital_id: Optional[int] = None
) -> None:
    """Log Deepgram TTS API usage"""
    cost = (audio_size / 1000000) * 0.01
    
    await log_api_usage(
        db,
        service_type="deepgram_tts",
        response_time_ms=response_time_ms,
        status=status,
        session_id=session_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        hospital_id=hospital_id,
        tokens_used=text_length,
        cost=cost,
        api_calls=1
    )


async def log_sarvam_stt(
    db: AsyncSession,
    *,
    audio_duration_sec: float,
    response_time_ms: int,
    transcript: str = "",
    status: str = "success",
    session_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    hospital_id: Optional[int] = None
) -> None:
    """Log Sarvam STT API usage with cost calculation"""
    cost = (audio_duration_sec / 60) * 0.002
    logger.info(f"🔄 Logging Sarvam STT: duration={audio_duration_sec:.2f}s, cost=${cost:.4f}, session_id={session_id}")
    
    await log_api_usage(
        db,
        service_type="sarvam_stt",
        response_time_ms=response_time_ms,
        status=status,
        session_id=session_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        hospital_id=hospital_id,
        tokens_used=len(transcript.split()) if transcript else 0,
        cost=cost,
        api_calls=1
    )
    
    logger.info(f"✅ Sarvam STT logged successfully")


async def log_sarvam_tts(
    db: AsyncSession,
    *,
    text_length: int,
    audio_size: int,
    response_time_ms: int,
    status: str = "success",
    session_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    hospital_id: Optional[int] = None
) -> None:
    """Log Sarvam TTS API usage"""
    cost = (audio_size / 1000000) * 0.005
    
    await log_api_usage(
        db,
        service_type="sarvam_tts",
        response_time_ms=response_time_ms,
        status=status,
        session_id=session_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        hospital_id=hospital_id,
        tokens_used=text_length,
        cost=cost,
        api_calls=1
    )


async def log_sarvam_translation(
    db: AsyncSession,
    *,
    input_length: int,
    output_length: int,
    response_time_ms: int,
    status: str = "success",
    session_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    hospital_id: Optional[int] = None
) -> None:
    """Log Sarvam Translation API usage"""
    cost = (input_length / 1000) * 0.001
    
    await log_api_usage(
        db,
        service_type="sarvam_translation",
        response_time_ms=response_time_ms,
        status=status,
        session_id=session_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        hospital_id=hospital_id,
        tokens_used=input_length + output_length,
        cost=cost,
        api_calls=1
    )


async def log_rag_retrieval(
    db: AsyncSession,
    *,
    context_length: int,
    response_time_ms: int,
    status: str = "success",
    session_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    hospital_id: Optional[int] = None
) -> None:
    """Log RAG retrieval API usage"""
    cost = (context_length / 1000) * 0.001
    
    await log_api_usage(
        db,
        service_type="rag_retrieval",
        response_time_ms=response_time_ms,
        status=status,
        session_id=session_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        hospital_id=hospital_id,
        tokens_used=context_length,
        cost=cost,
        api_calls=1
    )


# ==========================================
# ANALYTICS AGGREGATION
# ==========================================

class AnalyticsAggregationService:
    """
    Comprehensive analytics aggregation service
    Handles all analytics queries and reporting
    Maps to Consultation, ConsultationSessions, ConsultationMessages, ApiUsageLogs models
    """
    
    async def get_consultation_analytics(self, db: AsyncSession, hours: int = 24) -> Dict[str, Any]:
        """Analyze consultation data from Consultation and related tables"""
        try:
            time_threshold = datetime.utcnow() - timedelta(hours=hours)
            
            # Get consultation statistics
            consultation_stats = await db.execute(
                select(
                    func.count(Consultation.consultation_id).label('total_consultations'),
                    func.count(case((Consultation.status == 'completed', 1))).label('completed_consultations'),
                    func.count(case((Consultation.status == 'active', 1))).label('active_consultations'),
                    func.count(case((Consultation.status == 'scheduled', 1))).label('scheduled_consultations'),
                    func.avg(Consultation.total_duration).label('avg_duration_minutes'),
                    func.sum(Consultation.total_duration).label('total_duration_minutes')
                ).where(Consultation.created_at >= time_threshold)
            )
            
            consultation_data = consultation_stats.fetchone()
            
            # Get consultations by specialty
            specialty_stats = await db.execute(
                select(
                    Specialties.name.label('specialty_name'),
                    func.count(Consultation.consultation_id).label('consultation_count'),
                    func.avg(Consultation.total_duration).label('avg_duration')
                )
                .join(Consultation, Specialties.specialty_id == Consultation.specialty_id)
                .where(Consultation.created_at >= time_threshold)
                .group_by(Specialties.specialty_id, Specialties.name)
                .order_by(desc('consultation_count'))
            )
            
            specialty_data = specialty_stats.fetchall()
            
            # Get consultations by hospital
            hospital_stats = await db.execute(
                select(
                    HospitalMaster.hospital_name,
                    func.count(Consultation.consultation_id).label('consultation_count'),
                    func.avg(Consultation.total_duration).label('avg_duration')
                )
                .outerjoin(Consultation, HospitalMaster.hospital_id == Consultation.hospital_id)
                .where(Consultation.created_at >= time_threshold)
                .group_by(HospitalMaster.hospital_id, HospitalMaster.hospital_name)
                .order_by(desc('consultation_count'))
            )
            
            hospital_data = hospital_stats.fetchall()
            
            total_consultations = consultation_data.total_consultations or 0
            completed_consultations = consultation_data.completed_consultations or 0
            
            return {
                "total_consultations": total_consultations,
                "completed_consultations": completed_consultations,
                "active_consultations": consultation_data.active_consultations or 0,
                "scheduled_consultations": consultation_data.scheduled_consultations or 0,
                "avg_duration_minutes": float(consultation_data.avg_duration_minutes or 0),
                "total_duration_minutes": consultation_data.total_duration_minutes or 0,
                "completion_rate": (completed_consultations / max(total_consultations, 1)) * 100,
                "by_specialty": [
                    {
                        "specialty_name": row.specialty_name,
                        "consultation_count": row.consultation_count,
                        "avg_duration": float(row.avg_duration or 0)
                    } for row in specialty_data
                ],
                "by_hospital": [
                    {
                        "hospital_name": row.hospital_name or "No Hospital",
                        "consultation_count": row.consultation_count,
                        "avg_duration": float(row.avg_duration or 0)
                    } for row in hospital_data
                ]
            }
        except Exception as e:
            logger.error(f"Error in consultation analytics: {e}")
            return {"error": str(e)}
    
    async def get_session_analytics(self, db: AsyncSession, hours: int = 24) -> Dict[str, Any]:
        """Analyze consultation sessions data from ConsultationSessions table"""
        try:
            time_threshold = datetime.utcnow() - timedelta(hours=hours)
            
            # Get session statistics
            session_stats = await db.execute(
                select(
                    func.count(ConsultationSessions.session_id).label('total_sessions'),
                    func.count(case((ConsultationSessions.session_status == 'completed', 1))).label('completed_sessions'),
                    func.count(case((ConsultationSessions.session_status == 'active', 1))).label('active_sessions'),
                    func.avg(ConsultationSessions.total_tokens_used).label('avg_tokens_per_session'),
                    func.sum(ConsultationSessions.total_tokens_used).label('total_tokens_used'),
                    func.avg(ConsultationSessions.total_api_calls).label('avg_api_calls_per_session'),
                    func.sum(ConsultationSessions.total_api_calls).label('total_api_calls')
                ).where(ConsultationSessions.created_at >= time_threshold)
            )
            
            session_data = session_stats.fetchone()
            
            # Get sessions by type
            session_type_stats = await db.execute(
                select(
                    ConsultationSessions.session_type,
                    func.count(ConsultationSessions.session_id).label('session_count'),
                    func.avg(ConsultationSessions.total_tokens_used).label('avg_tokens'),
                    func.avg(ConsultationSessions.total_api_calls).label('avg_api_calls')
                )
                .where(ConsultationSessions.created_at >= time_threshold)
                .group_by(ConsultationSessions.session_type)
                .order_by(desc('session_count'))
            )
            
            session_type_data = session_type_stats.fetchall()
            
            total_sessions = session_data.total_sessions or 0
            completed_sessions = session_data.completed_sessions or 0
            
            return {
                "total_sessions": total_sessions,
                "completed_sessions": completed_sessions,
                "active_sessions": session_data.active_sessions or 0,
                "avg_tokens_per_session": float(session_data.avg_tokens_per_session or 0),
                "total_tokens_used": session_data.total_tokens_used or 0,
                "avg_api_calls_per_session": float(session_data.avg_api_calls_per_session or 0),
                "total_api_calls": session_data.total_api_calls or 0,
                "completion_rate": (completed_sessions / max(total_sessions, 1)) * 100,
                "by_type": [
                    {
                        "session_type": row.session_type,
                        "session_count": row.session_count,
                        "avg_tokens": float(row.avg_tokens or 0),
                        "avg_api_calls": float(row.avg_api_calls or 0)
                    } for row in session_type_data
                ]
            }
        except Exception as e:
            logger.error(f"Error in session analytics: {e}")
            return {"error": str(e)}
    
    async def get_message_analytics(self, db: AsyncSession, hours: int = 24) -> Dict[str, Any]:
        """Analyze consultation messages data from ConsultationMessages table"""
        try:
            time_threshold = datetime.utcnow() - timedelta(hours=hours)
            
            # Get message statistics
            message_stats = await db.execute(
                select(
                    func.count(ConsultationMessages.message_id).label('total_messages'),
                    func.count(case((ConsultationMessages.sender_type == 'patient', 1))).label('patient_messages'),
                    func.count(case((ConsultationMessages.sender_type == 'assistant', 1))).label('assistant_messages'),
                    func.avg(func.length(ConsultationMessages.message_text)).label('avg_message_length'),
                    func.avg(ConsultationMessages.processing_time_ms).label('avg_processing_time_ms'),
                    func.sum(ConsultationMessages.processing_time_ms).label('total_processing_time_ms')
                ).where(ConsultationMessages.timestamp >= time_threshold)
            )
            
            message_data = message_stats.fetchone()
            
            patient_messages = message_data.patient_messages or 0
            assistant_messages = message_data.assistant_messages or 0
            
            return {
                "total_messages": message_data.total_messages or 0,
                "patient_messages": patient_messages,
                "assistant_messages": assistant_messages,
                "avg_message_length": float(message_data.avg_message_length or 0),
                "avg_processing_time_ms": float(message_data.avg_processing_time_ms or 0),
                "total_processing_time_ms": message_data.total_processing_time_ms or 0,
                "message_ratio": (patient_messages / max(assistant_messages, 1)) if assistant_messages else 0
            }
        except Exception as e:
            logger.error(f"Error in message analytics: {e}")
            return {"error": str(e)}
    
    async def get_api_usage_analytics(self, db: AsyncSession, hours: int = 24) -> Dict[str, Any]:
        """Analyze API usage logs data from ApiUsageLogs table"""
        try:
            time_threshold = datetime.utcnow() - timedelta(hours=hours)
            
            # Get API usage statistics
            api_stats = await db.execute(
                select(
                    func.count(ApiUsageLogs.usage_id).label('total_api_calls'),
                    func.count(case((ApiUsageLogs.status == 'success', 1))).label('successful_calls'),
                    func.count(case((ApiUsageLogs.status == 'error', 1))).label('failed_calls'),
                    func.avg(ApiUsageLogs.response_time_ms).label('avg_response_time_ms'),
                    func.sum(ApiUsageLogs.tokens_used).label('total_tokens_used'),
                    func.sum(ApiUsageLogs.cost).label('total_cost'),
                    func.avg(ApiUsageLogs.cost).label('avg_cost_per_call')
                ).where(ApiUsageLogs.timestamp >= time_threshold)
            )
            
            api_data = api_stats.fetchone()
            
            # Get API usage by service type
            service_stats = await db.execute(
                select(
                    ApiUsageLogs.service_type,
                    func.count(ApiUsageLogs.usage_id).label('call_count'),
                    func.avg(ApiUsageLogs.response_time_ms).label('avg_response_time'),
                    func.sum(ApiUsageLogs.tokens_used).label('total_tokens'),
                    func.sum(ApiUsageLogs.cost).label('total_cost'),
                    func.avg(ApiUsageLogs.cost).label('avg_cost')
                )
                .where(ApiUsageLogs.timestamp >= time_threshold)
                .group_by(ApiUsageLogs.service_type)
                .order_by(desc('call_count'))
            )
            
            service_data = service_stats.fetchall()
            
            total_api_calls = api_data.total_api_calls or 0
            successful_calls = api_data.successful_calls or 0
            
            return {
                "total_api_calls": total_api_calls,
                "successful_calls": successful_calls,
                "failed_calls": api_data.failed_calls or 0,
                "avg_response_time_ms": float(api_data.avg_response_time_ms or 0),
                "total_tokens_used": api_data.total_tokens_used or 0,
                "total_cost": float(api_data.total_cost or 0),
                "avg_cost_per_call": float(api_data.avg_cost_per_call or 0),
                "success_rate": (successful_calls / max(total_api_calls, 1)) * 100,
                "by_service_type": [
                    {
                        "service_type": row.service_type,
                        "call_count": row.call_count,
                        "avg_response_time": float(row.avg_response_time or 0),
                        "total_tokens": row.total_tokens or 0,
                        "total_cost": float(row.total_cost or 0),
                        "avg_cost": float(row.avg_cost or 0)
                    } for row in service_data
                ]
            }
        except Exception as e:
            logger.error(f"Error in API usage analytics: {e}")
            return {"error": str(e)}
    
    async def get_rag_integration_analytics(self, db: AsyncSession, hours: int = 24) -> Dict[str, Any]:
        """Analyze RAG integration usage from ApiUsageLogs table"""
        try:
            time_threshold = datetime.utcnow() - timedelta(hours=hours)
            
            # Get RAG-related API usage
            rag_stats = await db.execute(
                select(
                    func.count(ApiUsageLogs.usage_id).label('rag_api_calls'),
                    func.count(case((ApiUsageLogs.status == 'success', 1))).label('successful_rag_calls'),
                    func.avg(ApiUsageLogs.response_time_ms).label('avg_rag_response_time'),
                    func.sum(ApiUsageLogs.tokens_used).label('total_rag_tokens'),
                    func.sum(ApiUsageLogs.cost).label('total_rag_cost')
                ).where(and_(
                    ApiUsageLogs.timestamp >= time_threshold,
                    or_(
                        ApiUsageLogs.service_type.like('%rag%'),
                        ApiUsageLogs.service_type.like('%retrieval%'),
                        ApiUsageLogs.service_type.like('%vector%')
                    )
                ))
            )
            
            rag_data = rag_stats.fetchone()
            
            total_rag_api_calls = rag_data.rag_api_calls or 0
            successful_rag_calls = rag_data.successful_rag_calls or 0
            
            return {
                "total_rag_api_calls": total_rag_api_calls,
                "successful_rag_calls": successful_rag_calls,
                "avg_rag_response_time": float(rag_data.avg_rag_response_time or 0),
                "total_rag_tokens": rag_data.total_rag_tokens or 0,
                "total_rag_cost": float(rag_data.total_rag_cost or 0),
                "rag_success_rate": (successful_rag_calls / max(total_rag_api_calls, 1)) * 100
            }
        except Exception as e:
            logger.error(f"Error in RAG integration analytics: {e}")
            return {"error": str(e)}
    
    async def get_comprehensive_analytics(self, db: AsyncSession, hours: int = 24) -> Dict[str, Any]:
        """Get comprehensive analytics for all database tables"""
        try:
            # Run all analytics in parallel
            tasks = [
                self.get_consultation_analytics(db, hours),
                self.get_session_analytics(db, hours),
                self.get_message_analytics(db, hours),
                self.get_api_usage_analytics(db, hours),
                self.get_rag_integration_analytics(db, hours)
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Build summary
            api_usage_data = results[3] if not isinstance(results[3], Exception) else {}
            
            return {
                "period_hours": hours,
                "generated_at": datetime.now().isoformat(),
                "summary": {
                    "total_requests": api_usage_data.get("total_api_calls", 0),
                    "total_cost_usd": api_usage_data.get("total_cost", 0),
                    "total_cost_inr": api_usage_data.get("total_cost", 0) * 83.0,
                    "avg_latency_ms": api_usage_data.get("avg_response_time_ms", 0),
                    "avg_accuracy": api_usage_data.get("success_rate", 0),
                    "error_rate": 100 - api_usage_data.get("success_rate", 100),
                    "total_medical_terms": 0
                },
                "api_breakdown": [
                    {
                        "api_type": item["service_type"],
                        "request_count": item["call_count"],
                        "cost_usd": item["total_cost"],
                        "avg_latency_ms": item["avg_response_time"],
                        "avg_accuracy": 100.0
                    } for item in api_usage_data.get("by_service_type", [])
                ],
                "consultation_analytics": results[0] if not isinstance(results[0], Exception) else {"error": str(results[0])},
                "session_analytics": results[1] if not isinstance(results[1], Exception) else {"error": str(results[1])},
                "message_analytics": results[2] if not isinstance(results[2], Exception) else {"error": str(results[2])},
                "api_usage_analytics": results[3] if not isinstance(results[3], Exception) else {"error": str(results[3])},
                "rag_integration_analytics": results[4] if not isinstance(results[4], Exception) else {"error": str(results[4])}
            }
        except Exception as e:
            logger.error(f"Error in comprehensive analytics: {e}")
            return {"error": str(e)}
    
    async def get_cost_breakdown(self, db: AsyncSession, hours: int = 24) -> Dict[str, Any]:
        """Get detailed cost breakdown from ApiUsageLogs"""
        try:
            api_analytics = await self.get_api_usage_analytics(db, hours)
            rag_analytics = await self.get_rag_integration_analytics(db, hours)
            
            return {
                "period_hours": hours,
                "total_cost": api_analytics.get("total_cost", 0),
                "api_usage_costs": api_analytics.get("by_service_type", []),
                "rag_costs": [],
                "cost_summary": {
                    "total_api_cost": api_analytics.get("total_cost", 0),
                    "total_rag_cost": rag_analytics.get("total_rag_cost", 0),
                    "avg_cost_per_call": api_analytics.get("avg_cost_per_call", 0)
                }
            }
        except Exception as e:
            logger.error(f"Error in cost breakdown: {e}")
            return {"error": str(e)}
    
    async def get_performance_metrics(self, db: AsyncSession, hours: int = 24) -> Dict[str, Any]:
        """Get performance metrics from ApiUsageLogs, ConsultationSessions, and ConsultationMessages"""
        try:
            api_analytics = await self.get_api_usage_analytics(db, hours)
            session_analytics = await self.get_session_analytics(db, hours)
            message_analytics = await self.get_message_analytics(db, hours)
            
            return {
                "period_hours": hours,
                "api_performance": {
                    "avg_response_time_ms": api_analytics.get("avg_response_time_ms", 0),
                    "success_rate": api_analytics.get("success_rate", 0),
                    "total_calls": api_analytics.get("total_api_calls", 0)
                },
                "session_performance": {
                    "avg_tokens_per_session": session_analytics.get("avg_tokens_per_session", 0),
                    "completion_rate": session_analytics.get("completion_rate", 0),
                    "total_sessions": session_analytics.get("total_sessions", 0)
                },
                "message_performance": {
                    "avg_processing_time_ms": message_analytics.get("avg_processing_time_ms", 0),
                    "avg_message_length": message_analytics.get("avg_message_length", 0),
                    "total_messages": message_analytics.get("total_messages", 0)
                }
            }
        except Exception as e:
            logger.error(f"Error in performance metrics: {e}")
            return {"error": str(e)}
    
    async def get_medical_analysis(self, db: AsyncSession, hours: int = 24) -> Dict[str, Any]:
        """Analyze medical vocabulary from ConsultationMessages"""
        try:
            message_analytics = await self.get_message_analytics(db, hours)
            
            return {
                "period_hours": hours,
                "message_analysis": {
                    "total_messages": message_analytics.get("total_messages", 0),
                    "avg_message_length": message_analytics.get("avg_message_length", 0),
                    "patient_assistant_ratio": message_analytics.get("message_ratio", 0)
                }
            }
        except Exception as e:
            logger.error(f"Error in medical analysis: {e}")
            return {"error": str(e)}
    
    async def get_single_consultation_analytics(self, db: AsyncSession, consultation_id: int) -> Dict[str, Any]:
        """Get comprehensive analytics for a single consultation including sessions and API usage"""
        try:
            # Get consultation details
            consultation_result = await db.execute(
                select(Consultation).where(Consultation.consultation_id == consultation_id)
            )
            consultation = consultation_result.scalar_one_or_none()
            
            if not consultation:
                return {"error": "Consultation not found"}
            
            # Get sessions for this consultation
            sessions_result = await db.execute(
                select(ConsultationSessions)
                .where(ConsultationSessions.consultation_id == consultation_id)
                .order_by(ConsultationSessions.created_at.desc())
            )
            sessions = sessions_result.scalars().all()
            
            # Get API usage for this consultation (via session IDs)
            session_ids = [s.session_id for s in sessions]
            api_usage_data = []
            
            if session_ids:
                api_usage_result = await db.execute(
                    select(
                        ApiUsageLogs.service_type,
                        func.count(ApiUsageLogs.usage_id).label('call_count'),
                        func.sum(ApiUsageLogs.tokens_used).label('total_tokens'),
                        func.sum(ApiUsageLogs.cost).label('total_cost'),
                        func.avg(ApiUsageLogs.response_time_ms).label('avg_latency')
                    )
                    .where(ApiUsageLogs.session_id.in_(session_ids))
                    .group_by(ApiUsageLogs.service_type)
                )
                api_usage_rows = api_usage_result.fetchall()
                api_usage_data = [
                    {
                        "service_type": row.service_type,
                        "call_count": row.call_count,
                        "total_tokens": row.total_tokens or 0,
                        "total_cost": float(row.total_cost or 0),
                        "avg_latency": float(row.avg_latency or 0)
                    } for row in api_usage_rows
                ]
            
            return {
                "consultation": {
                    "consultation_id": consultation.consultation_id,
                    "patient_id": consultation.patient_id,
                    "doctor_id": consultation.doctor_id,
                    "specialty_id": consultation.specialty_id,
                    "hospital_id": consultation.hospital_id,
                    "status": consultation.status,
                    "total_duration": consultation.total_duration,
                    "created_at": consultation.created_at.isoformat() if consultation.created_at else None
                },
                "sessions": [
                    {
                        "session_id": session.session_id,
                        "session_type": session.session_type,
                        "session_status": session.session_status,
                        "total_tokens_used": session.total_tokens_used,
                        "total_api_calls": session.total_api_calls,
                        "created_at": session.created_at.isoformat() if session.created_at else None
                    } for session in sessions
                ],
                "api_usage": api_usage_data
            }
        except Exception as e:
            logger.error(f"Error in single consultation analytics for ID {consultation_id}: {e}")
            return {"error": str(e)}


# Create singleton instance for analytics aggregation
analytics_aggregation = AnalyticsAggregationService()
