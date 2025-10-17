from typing import Optional
import datetime
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from sqlalchemy.exc import (
    IntegrityError,
    OperationalError,
    DBAPIError,
    DatabaseError as SQLAlchemyDatabaseError,
    InvalidRequestError,
    DisconnectionError
)

from models.models import (
    Consultation,
    ConsultationSessions,
    ConsultationMessages,
    ConsultationTranscripts,
    ApiUsageLogs,
)

from service.audit_service import create_audit_log as _create_audit_log
from centralisedErrorHandling.ErrorHandling import (
    DatabaseError,
    SessionError,
    TransactionError,
    ConnectionError,
    DataIntegrityError,
    ResourceNotFoundError
)

logger = logging.getLogger(__name__)


async def _safe_rollback(db: AsyncSession, table_name: str) -> None:
    """Safely attempt database rollback with error handling"""
    try:
        await db.rollback()
        logger.info(f"Successfully rolled back transaction for {table_name}")
    except InvalidRequestError as e:
        logger.warning(f"Rollback skipped - no transaction active for {table_name}: {e}")
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database connection lost during rollback for {table_name}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during rollback for {table_name}: {e}", exc_info=True)
        # Don't raise - we're already in error handling


async def create_consultation(
    db: AsyncSession,
    *,
    patient_id: int,
    doctor_id: int,
    specialty_id: int,
    hospital_id: Optional[int] = None,
    consultation_type: str = "hospital",
) -> int:
    """Create a new consultation record"""
    try:
        consult = Consultation(
            patient_id=int(patient_id),
            doctor_id=int(doctor_id),
            specialty_id=int(specialty_id),
            hospital_id=int(hospital_id) if hospital_id is not None else None,
            consultation_type=consultation_type,
            status="Active",
            total_duration=0
        )
        db.add(consult)
        
        # Flush with explicit exception handling
        try:
            await db.flush()
        except IntegrityError as e:
            await _safe_rollback(db, "consultation")
            logger.error(f"Integrity error during consultation flush: {e}")
            raise DataIntegrityError(
                "Foreign key or unique constraint violation during consultation creation",
                constraint_type="foreign_key",
                table="consultation",
                field="patient_id/doctor_id/specialty_id",
                value={"patient_id": patient_id, "doctor_id": doctor_id, "specialty_id": specialty_id},
                original_error=e,
                context={
                    "operation": "create_consultation_flush",
                    "hospital_id": hospital_id,
                    "consultation_type": consultation_type
                }
            )
        except (DisconnectionError, OperationalError) as e:
            await _safe_rollback(db, "consultation")
            logger.error(f"Database connection error during consultation flush: {e}")
            raise ConnectionError(
                "Database connection failed during consultation creation",
                operation="create_consultation_flush",
                original_error=e,
                context={
                    "table": "consultation",
                    "patient_id": patient_id,
                    "doctor_id": doctor_id,
                    "specialty_id": specialty_id
                }
            )
        except InvalidRequestError as e:
            await _safe_rollback(db, "consultation")
            logger.error(f"Invalid session state during consultation flush: {e}")
            raise TransactionError(
                "Session state error during consultation creation",
                operation="create_consultation_flush",
                table="consultation",
                transaction_state="flush_failed",
                original_error=e,
                context={
                    "patient_id": patient_id,
                    "doctor_id": doctor_id,
                    "specialty_id": specialty_id
                }
            )
        
        # Refresh with explicit exception handling
        try:
            await db.refresh(consult)
        except InvalidRequestError as e:
            await _safe_rollback(db, "consultation")
            logger.error(f"Invalid session state during consultation refresh: {e}")
            raise TransactionError(
                "Session state error during consultation refresh",
                operation="create_consultation_refresh",
                table="consultation",
                transaction_state="refresh_failed",
                original_error=e,
                context={
                    "patient_id": patient_id,
                    "doctor_id": doctor_id
                }
            )
        except (DisconnectionError, OperationalError) as e:
            await _safe_rollback(db, "consultation")
            logger.error(f"Database connection error during consultation refresh: {e}")
            raise ConnectionError(
                "Database connection failed during consultation refresh",
                operation="create_consultation_refresh",
                original_error=e,
                context={
                    "table": "consultation",
                    "patient_id": patient_id,
                    "doctor_id": doctor_id
                }
            )
        
        await db.commit()
        
        logger.info(f"Created consultation {consult.consultation_id} for patient {patient_id}")
        return int(consult.consultation_id)
    
    except IntegrityError as e:
        await _safe_rollback(db, "consultation")
        logger.error(f"Integrity error in create_consultation: {e}")
        raise DataIntegrityError(
            "Foreign key or unique constraint violation during consultation creation",
            constraint_type="foreign_key",
            table="consultation",
            original_error=e
        )
    
    except (DisconnectionError, OperationalError) as e:
        await _safe_rollback(db, "consultation")
        logger.error(f"Connection error in create_consultation: {e}")
        raise ConnectionError(
            "Database connection failed during consultation creation",
            operation="create_consultation",
            original_error=e
        )
    
    except InvalidRequestError as e:
        await _safe_rollback(db, "consultation")
        logger.error(f"Invalid session state in create_consultation: {e}")
        raise TransactionError(
            "Session state error during consultation creation",
            operation="flush/refresh",
            table="consultation",
            original_error=e
        )
    
    except Exception as e:
        await _safe_rollback(db, "consultation")
        logger.error(f"Unexpected error in create_consultation: {e}", exc_info=True)
        raise DatabaseError(
            "Unexpected error during consultation creation",
            operation="insert",
            table="consultation",
            original_error=e
        )


async def get_or_create_session(
    db: AsyncSession,
    *,
    consultation_id: int,
    session_type: str = "text",
) -> int:
    """Get existing active session or create new one to prevent multiple sessions"""
    try:
        from sqlalchemy import select
        
        # Check if there's an active session for this consultation
        result = await db.execute(
            select(ConsultationSessions)
            .where(
                ConsultationSessions.consultation_id == consultation_id,
                ConsultationSessions.session_status == "active"
            )
            .order_by(ConsultationSessions.created_at.desc())
        )
        existing_session = result.scalar_one_or_none()
        
        if existing_session:
            logger.debug(f"Reusing existing session {existing_session.session_id} for consultation {consultation_id}")
            return int(existing_session.session_id)
        
        # Create new session if none exists
        session = ConsultationSessions(
            consultation_id=int(consultation_id),
            session_type=session_type,
            session_status="active",
            total_tokens_used=0,
            total_api_calls=0
        )
        db.add(session)
        
        # Flush with explicit exception handling
        try:
            await db.flush()
        except IntegrityError as e:
            await _safe_rollback(db, "consultation_sessions")
            logger.error(f"Integrity error during session flush: {e}")
            raise DataIntegrityError(
                "Foreign key violation - consultation may not exist",
                constraint_type="foreign_key",
                table="consultation_sessions",
                field="consultation_id",
                value=consultation_id,
                original_error=e,
                context={
                    "operation": "get_or_create_session_flush",
                    "session_type": session_type
                }
            )
        except (DisconnectionError, OperationalError) as e:
            await _safe_rollback(db, "consultation_sessions")
            logger.error(f"Database connection error during session flush: {e}")
            raise ConnectionError(
                "Database connection failed during session creation",
                operation="get_or_create_session_flush",
                original_error=e,
                context={
                    "table": "consultation_sessions",
                    "consultation_id": consultation_id,
                    "session_type": session_type
                }
            )
        except InvalidRequestError as e:
            await _safe_rollback(db, "consultation_sessions")
            logger.error(f"Invalid session state during session flush: {e}")
            raise SessionError(
                "Session state error during session creation",
                consultation_id=consultation_id,
                session_status="active",
                original_error=e,
                context={
                    "operation": "get_or_create_session_flush",
                    "session_type": session_type
                }
            )
        
        # Refresh with explicit exception handling
        try:
            await db.refresh(session)
        except InvalidRequestError as e:
            await _safe_rollback(db, "consultation_sessions")
            logger.error(f"Invalid session state during session refresh: {e}")
            raise SessionError(
                "Session state error during session refresh",
                consultation_id=consultation_id,
                session_status="active",
                original_error=e,
                context={
                    "operation": "get_or_create_session_refresh",
                    "session_type": session_type
                }
            )
        except (DisconnectionError, OperationalError) as e:
            await _safe_rollback(db, "consultation_sessions")
            logger.error(f"Database connection error during session refresh: {e}")
            raise ConnectionError(
                "Database connection failed during session refresh",
                operation="get_or_create_session_refresh",
                original_error=e,
                context={
                    "table": "consultation_sessions",
                    "consultation_id": consultation_id,
                    "session_type": session_type
                }
            )
        
        await db.commit()
        
        logger.info(f"Created new session {session.session_id} for consultation {consultation_id}")
        return int(session.session_id)
    
    except IntegrityError as e:
        await _safe_rollback(db, "consultation_sessions")
        logger.error(f"Integrity error in get_or_create_session: {e}")
        raise DataIntegrityError(
            "Foreign key violation - consultation may not exist",
            constraint_type="foreign_key",
            table="consultation_sessions",
            original_error=e
        )
    
    except (DisconnectionError, OperationalError) as e:
        await _safe_rollback(db, "consultation_sessions")
        logger.error(f"Connection error in get_or_create_session: {e}")
        raise ConnectionError(
            "Database connection failed during session creation",
            operation="get_or_create_session",
            original_error=e
        )
    
    except InvalidRequestError as e:
        await _safe_rollback(db, "consultation_sessions")
        logger.error(f"Invalid session state in get_or_create_session: {e}")
        raise SessionError(
            "Session state error - multiple active sessions or invalid state",
            consultation_id=consultation_id,
            original_error=e
        )
    
    except Exception as e:
        await _safe_rollback(db, "consultation_sessions")
        logger.error(f"Unexpected error in get_or_create_session: {e}", exc_info=True)
        raise DatabaseError(
            "Unexpected error during session creation",
            operation="insert",
            table="consultation_sessions",
            original_error=e
        )


async def open_session(
    db: AsyncSession,
    *,
    consultation_id: int,
    session_type: str = "text",
) -> int:
    """Legacy function - now uses get_or_create_session to prevent duplicates"""
    return await get_or_create_session(db, consultation_id=consultation_id, session_type=session_type)


async def close_session(
    db: AsyncSession,
    *,
    session_id: int,
    status: str = "closed",
) -> None:
    """Close a consultation session and update consultation duration"""
    try:
        from sqlalchemy import select, func
        
        # Get consultation_id for this session
        result = await db.execute(
            select(ConsultationSessions.consultation_id)
            .where(ConsultationSessions.session_id == int(session_id))
        )
        consultation_id = result.scalar_one_or_none()
        
        if not consultation_id:
            logger.warning(f"Session {session_id} not found or has no consultation_id")
            raise ResourceNotFoundError(
                f"Session {session_id} not found",
                resource_type="session",
                resource_id=session_id
            )
        
        # Close the session using database server time to avoid timezone mismatch
        q = (
            update(ConsultationSessions)
            .where(ConsultationSessions.session_id == int(session_id))
            .values(session_end=func.now(), session_status=status)
        )
        await db.execute(q)
        
        # Update consultation duration (MySQL-compatible timestamp difference)
        result = await db.execute(
            select(func.sum(
                func.unix_timestamp(ConsultationSessions.session_end) - 
                func.unix_timestamp(ConsultationSessions.session_start)
            ).label('total_seconds'))
            .where(
                ConsultationSessions.consultation_id == int(consultation_id),
                ConsultationSessions.session_end.isnot(None)
            )
        )
        total_seconds = result.scalar() or 0
        
        # Check if all sessions are completed/closed
        result = await db.execute(
            select(func.count(ConsultationSessions.session_id))
            .where(
                ConsultationSessions.consultation_id == int(consultation_id),
                ConsultationSessions.session_status == "active"
            )
        )
        active_sessions_count = result.scalar() or 0
        
        # Update consultation status to completed if no active sessions remain
        consultation_status = "completed" if active_sessions_count == 0 else "Active"
        
        q2 = (
            update(Consultation)
            .where(Consultation.consultation_id == int(consultation_id))
            .values(
                total_duration=int(total_seconds),
                status=consultation_status
            )
        )
        await db.execute(q2)
        await db.commit()
        
        logger.info(f"Successfully closed session {session_id} with status '{status}', consultation status updated to '{consultation_status}'")
    
    except IntegrityError as e:
        await _safe_rollback(db, "consultation_sessions")
        logger.error(f"Integrity error in close_session: {e}")
        raise DataIntegrityError(
            "Data integrity error during session close",
            constraint_type="foreign_key",
            table="consultation_sessions",
            original_error=e
        )
    
    except (DisconnectionError, OperationalError) as e:
        await _safe_rollback(db, "consultation_sessions")
        logger.error(f"Connection error in close_session: {e}")
        raise ConnectionError(
            "Database connection failed during session close",
            operation="close_session",
            original_error=e
        )
    
    except InvalidRequestError as e:
        await _safe_rollback(db, "consultation_sessions")
        logger.error(f"Transaction error in close_session: {e}")
        raise TransactionError(
            "Transaction state error during session close",
            operation="update/commit",
            table="consultation_sessions",
            original_error=e
        )
    
    except ResourceNotFoundError:
        # Re-raise resource not found as-is
        raise
    
    except Exception as e:
        await _safe_rollback(db, "consultation_sessions")
        logger.error(f"Unexpected error in close_session: {e}", exc_info=True)
        raise DatabaseError(
            "Unexpected error during session close",
            operation="update",
            table="consultation_sessions",
            original_error=e
        )


async def update_consultation_status(
    db: AsyncSession,
    *,
    consultation_id: int,
    status: str,
    total_duration: Optional[int] = None,
) -> None:
    """Update consultation status and total duration using existing fields"""
    try:
        update_values = {"status": status}
        if total_duration is not None:
            update_values["total_duration"] = total_duration
            
        q = (
            update(Consultation)
            .where(Consultation.consultation_id == int(consultation_id))
            .values(**update_values)
        )
        
        try:
            await db.execute(q)
        except (DisconnectionError, OperationalError) as e:
            logger.error(f"Database connection error during consultation status update: {e}")
            await _safe_rollback(db, "consultation")
            raise DatabaseError("Database connection failed during status update", operation="update", table="consultation", original_error=e)
        
        try:
            await db.commit()
            logger.info(f"Updated consultation {consultation_id} status to '{status}'")
        except IntegrityError as e:
            logger.error(f"Integrity constraint violation during consultation update: {e}")
            await _safe_rollback(db, "consultation")
            raise DatabaseError("Data integrity error during status update", operation="commit", table="consultation", original_error=e)
    
    except IntegrityError as e:
        logger.error(f"Integrity error in update_consultation_status: {e}")
        await _safe_rollback(db, "consultation")
        raise DatabaseError("Data integrity error", operation="update", table="consultation", original_error=e)
    
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database operational error in update_consultation_status: {e}")
        await _safe_rollback(db, "consultation")
        raise DatabaseError("Database connection or operational error", operation="update", table="consultation", original_error=e)
    
    except SQLAlchemyDatabaseError as e:
        logger.error(f"SQLAlchemy database error in update_consultation_status: {e}")
        await _safe_rollback(db, "consultation")
        raise DatabaseError("Database error during status update", operation="update", table="consultation", original_error=e)
    
    except Exception as e:
        logger.error(f"Unexpected error in update_consultation_status: {e}", exc_info=True)
        await _safe_rollback(db, "consultation")
        raise DatabaseError("Unexpected error during status update", operation="update", table="consultation", original_error=e)


async def update_session_tokens(
    db: AsyncSession,
    *,
    session_id: int,
    tokens_used: int,
) -> None:
    """Update session with total tokens used using existing field"""
    try:
        q = (
            update(ConsultationSessions)
            .where(ConsultationSessions.session_id == int(session_id))
            .values(total_tokens_used=ConsultationSessions.total_tokens_used + tokens_used)
        )
        
        try:
            await db.execute(q)
        except (DisconnectionError, OperationalError) as e:
            logger.error(f"Database connection error during token update: {e}")
            await _safe_rollback(db, "consultation_sessions")
            raise DatabaseError("Database connection failed during token update", operation="update", table="consultation_sessions", original_error=e)
        
        try:
            await db.commit()
            logger.debug(f"Updated session {session_id} with {tokens_used} tokens")
        except IntegrityError as e:
            logger.error(f"Integrity constraint violation during token update: {e}")
            await _safe_rollback(db, "consultation_sessions")
            raise DatabaseError("Data integrity error during token update", operation="commit", table="consultation_sessions", original_error=e)
    
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database operational error in update_session_tokens: {e}")
        await _safe_rollback(db, "consultation_sessions")
        raise DatabaseError("Database connection or operational error", operation="update", table="consultation_sessions", original_error=e)
    
    except SQLAlchemyDatabaseError as e:
        logger.error(f"SQLAlchemy database error in update_session_tokens: {e}")
        await _safe_rollback(db, "consultation_sessions")
        raise DatabaseError("Database error during token update", operation="update", table="consultation_sessions", original_error=e)
    
    except Exception as e:
        logger.error(f"Unexpected error in update_session_tokens: {e}", exc_info=True)
        await _safe_rollback(db, "consultation_sessions")
        raise DatabaseError("Unexpected error during token update", operation="update", table="consultation_sessions", original_error=e)


async def append_message(
    db: AsyncSession,
    *,
    session_id: int,
    sender_type: str,
    message_text: Optional[str],
    audio_url: Optional[str] = None,
    processing_time_ms: Optional[int] = None,
) -> None:
    try:
        db.add(ConsultationMessages(
            session_id=int(session_id),
            sender_type=sender_type,
            message_text=message_text or "",
            audio_url=audio_url,
            processing_time_ms=int(processing_time_ms or 1000),
        ))
        
        try:
            await db.commit()
            logger.debug(f"Appended {sender_type} message to session {session_id}")
        except IntegrityError as e:
            logger.error(f"Integrity constraint violation during message append: {e}")
            await _safe_rollback(db, "consultation_messages")
            raise DatabaseError("Foreign key violation - session may not exist", operation="commit", table="consultation_messages", original_error=e)
        except (DisconnectionError, OperationalError) as e:
            logger.error(f"Database connection error during message append: {e}")
            await _safe_rollback(db, "consultation_messages")
            raise DatabaseError("Database connection failed during message append", operation="commit", table="consultation_messages", original_error=e)
    
    except IntegrityError as e:
        logger.error(f"Integrity error in append_message: {e}")
        await _safe_rollback(db, "consultation_messages")
        raise DatabaseError("Foreign key or constraint violation", operation="insert", table="consultation_messages", original_error=e)
    
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database operational error in append_message: {e}")
        await _safe_rollback(db, "consultation_messages")
        raise DatabaseError("Database connection or operational error", operation="insert", table="consultation_messages", original_error=e)
    
    except SQLAlchemyDatabaseError as e:
        logger.error(f"SQLAlchemy database error in append_message: {e}")
        await _safe_rollback(db, "consultation_messages")
        raise DatabaseError("Database error during message append", operation="insert", table="consultation_messages", original_error=e)
    
    except Exception as e:
        logger.error(f"Unexpected error in append_message: {e}", exc_info=True)
        await _safe_rollback(db, "consultation_messages")
        raise DatabaseError("Unexpected error during message append", operation="insert", table="consultation_messages", original_error=e)


async def append_audio_message(
    db: AsyncSession,
    *,
    session_id: int,
    sender_type: str,
    message_text: Optional[str],
    audio_url: str,
    processing_time_ms: int,
) -> None:
    """Enhanced message logging with audio URL and processing time"""
    try:
        db.add(ConsultationMessages(
            session_id=int(session_id),
            sender_type=sender_type,
            message_text=message_text or "",
            audio_url=audio_url,
            processing_time_ms=int(processing_time_ms or 1000),
        ))
        
        try:
            await db.commit()
            logger.debug(f"Appended {sender_type} audio message to session {session_id}")
        except IntegrityError as e:
            logger.error(f"Integrity constraint violation during audio message append: {e}")
            await _safe_rollback(db, "consultation_messages")
            raise DatabaseError("Foreign key violation - session may not exist", operation="commit", table="consultation_messages", original_error=e)
        except (DisconnectionError, OperationalError) as e:
            logger.error(f"Database connection error during audio message append: {e}")
            await _safe_rollback(db, "consultation_messages")
            raise DatabaseError("Database connection failed during audio message append", operation="commit", table="consultation_messages", original_error=e)
    
    except IntegrityError as e:
        logger.error(f"Integrity error in append_audio_message: {e}")
        await _safe_rollback(db, "consultation_messages")
        raise DatabaseError("Foreign key or constraint violation", operation="insert", table="consultation_messages", original_error=e)
    
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database operational error in append_audio_message: {e}")
        await _safe_rollback(db, "consultation_messages")
        raise DatabaseError("Database connection or operational error", operation="insert", table="consultation_messages", original_error=e)
    
    except SQLAlchemyDatabaseError as e:
        logger.error(f"SQLAlchemy database error in append_audio_message: {e}")
        await _safe_rollback(db, "consultation_messages")
        raise DatabaseError("Database error during audio message append", operation="insert", table="consultation_messages", original_error=e)
    
    except Exception as e:
        logger.error(f"Unexpected error in append_audio_message: {e}", exc_info=True)
        await _safe_rollback(db, "consultation_messages")
        raise DatabaseError("Unexpected error during audio message append", operation="insert", table="consultation_messages", original_error=e)


async def get_session_transcript_text(
    db: AsyncSession,
    *,
    session_id: int,
) -> str:
    """Get formatted transcript text from session messages"""
    try:
        from sqlalchemy import select
        
        # Get all messages for this session
        try:
            result = await db.execute(
                select(ConsultationMessages)
                .where(ConsultationMessages.session_id == int(session_id))
                .order_by(ConsultationMessages.timestamp)
            )
            messages = result.scalars().all()
        except (DisconnectionError, OperationalError) as e:
            logger.error(f"Database connection error while fetching transcript: {e}")
            raise DatabaseError("Database connection failed while fetching transcript", operation="select", table="consultation_messages", original_error=e)
        
        # Format transcript
        try:
            transcript_lines = []
            for msg in messages:
                sender = "Patient" if msg.sender_type == "patient" else "Doctor"
                text = msg.message_text or ""
                timestamp = msg.timestamp.strftime("%Y-%m-%d %H:%M:%S") if msg.timestamp else ""
                transcript_lines.append(f"[{timestamp}] {sender}: {text}")
            
            transcript = "\n".join(transcript_lines)
            logger.debug(f"Retrieved transcript for session {session_id} with {len(messages)} messages")
            return transcript
        except Exception as e:
            logger.error(f"Error formatting transcript: {e}")
            raise DatabaseError("Failed to format transcript", operation="format", table="consultation_messages", original_error=e)
    
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database operational error in get_session_transcript_text: {e}")
        raise DatabaseError("Database connection or operational error", operation="select", table="consultation_messages", original_error=e)
    
    except SQLAlchemyDatabaseError as e:
        logger.error(f"SQLAlchemy database error in get_session_transcript_text: {e}")
        raise DatabaseError("Database error while getting transcript", operation="select", table="consultation_messages", original_error=e)
    
    except Exception as e:
        logger.error(f"Unexpected error in get_session_transcript_text: {e}", exc_info=True)
        raise DatabaseError("Unexpected error while getting transcript", operation="select", table="consultation_messages", original_error=e)


async def save_transcript(
    db: AsyncSession,
    *,
    consultation_id: int,
    transcript_text: str,
    file_url: Optional[str] = None,
) -> int:
    """Save consultation transcript to database.
    
    Note: Only consultation_id, transcript_text, and file_url are stored.
    The model does NOT include hospital_id, doctor_id, patient_id, or service_type.
    """
    try:
        row = ConsultationTranscripts(
            consultation_id=int(consultation_id),
            transcript_text=transcript_text,
            file_url=file_url,
        )
        db.add(row)
        
        # Flush with explicit exception handling
        try:
            await db.flush()
        except IntegrityError as e:
            await _safe_rollback(db, "consultation_transcripts")
            logger.error(f"Integrity error during transcript flush: {e}")
            raise DataIntegrityError(
                "Foreign key violation - consultation may not exist",
                constraint_type="foreign_key",
                table="consultation_transcripts",
                field="consultation_id",
                value=consultation_id,
                original_error=e,
                context={
                    "operation": "save_transcript_flush",
                    "transcript_length": len(transcript_text),
                    "has_file_url": bool(file_url)
                }
            )
        except (DisconnectionError, OperationalError) as e:
            await _safe_rollback(db, "consultation_transcripts")
            logger.error(f"Database connection error during transcript flush: {e}")
            raise ConnectionError(
                "Database connection failed during transcript save",
                operation="save_transcript_flush",
                original_error=e,
                context={
                    "table": "consultation_transcripts",
                    "consultation_id": consultation_id,
                    "transcript_length": len(transcript_text)
                }
            )
        except InvalidRequestError as e:
            await _safe_rollback(db, "consultation_transcripts")
            logger.error(f"Invalid session state during transcript flush: {e}")
            raise TransactionError(
                "Session state error during transcript save",
                operation="save_transcript_flush",
                table="consultation_transcripts",
                transaction_state="flush_failed",
                original_error=e,
                context={
                    "consultation_id": consultation_id,
                    "transcript_length": len(transcript_text)
                }
            )
        
        # Refresh with explicit exception handling
        try:
            await db.refresh(row)
        except InvalidRequestError as e:
            await _safe_rollback(db, "consultation_transcripts")
            logger.error(f"Invalid session state during transcript refresh: {e}")
            raise TransactionError(
                "Session state error during transcript refresh",
                operation="save_transcript_refresh",
                table="consultation_transcripts",
                transaction_state="refresh_failed",
                original_error=e,
                context={
                    "consultation_id": consultation_id,
                    "transcript_length": len(transcript_text)
                }
            )
        except (DisconnectionError, OperationalError) as e:
            await _safe_rollback(db, "consultation_transcripts")
            logger.error(f"Database connection error during transcript refresh: {e}")
            raise ConnectionError(
                "Database connection failed during transcript refresh",
                operation="save_transcript_refresh",
                original_error=e,
                context={
                    "table": "consultation_transcripts",
                    "consultation_id": consultation_id,
                    "transcript_length": len(transcript_text)
                }
            )
        
        try:
            await db.commit()
        except IntegrityError as e:
            logger.error(f"Integrity constraint violation during transcript save: {e}")
            await _safe_rollback(db, "consultation_transcripts")
            raise DatabaseError("Foreign key violation - consultation may not exist", operation="commit", table="consultation_transcripts", original_error=e)
        
        logger.info(f"Saved transcript {row.transcript_id} for consultation {consultation_id}")
        return int(row.transcript_id)
    
    except IntegrityError as e:
        logger.error(f"Integrity error in save_transcript: {e}")
        await _safe_rollback(db, "consultation_transcripts")
        raise DatabaseError("Foreign key or constraint violation", operation="insert", table="consultation_transcripts", original_error=e)
    
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database operational error in save_transcript: {e}")
        await _safe_rollback(db, "consultation_transcripts")
        raise DatabaseError("Database connection or operational error", operation="insert", table="consultation_transcripts", original_error=e)
    
    except SQLAlchemyDatabaseError as e:
        logger.error(f"SQLAlchemy database error in save_transcript: {e}")
        await _safe_rollback(db, "consultation_transcripts")
        raise DatabaseError("Database error during transcript save", operation="insert", table="consultation_transcripts", original_error=e)
    
    except Exception as e:
        logger.error(f"Unexpected error in save_transcript: {e}", exc_info=True)
        await _safe_rollback(db, "consultation_transcripts")
        raise DatabaseError("Unexpected error during transcript save", operation="insert", table="consultation_transcripts", original_error=e)


async def record_turn(
    db: AsyncSession,
    *,
    session_id: int,
    patient_text: Optional[str],
    assistant_text: Optional[str],
    service_type: str,
    response_time_ms: int,
    status: str = "success",
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    hospital_id: Optional[int] = None,
    tokens_used: Optional[int] = None,
    cost: Optional[float] = None,
    audio_url: Optional[str] = None,
    processing_time_ms: Optional[int] = None,
) -> None:
    """Enhanced turn recording with comprehensive API logging and audio data."""
    try:
        # Use response_time_ms if processing_time_ms is not provided or is 0
        proc_time = processing_time_ms if processing_time_ms and processing_time_ms > 0 else response_time_ms
        
        if patient_text:
            db.add(ConsultationMessages(
                session_id=int(session_id),
                sender_type="patient",
                message_text=patient_text or "",
                audio_url=audio_url,
                processing_time_ms=int(proc_time or 1000),
            ))
        if assistant_text:
            db.add(ConsultationMessages(
                session_id=int(session_id),
                sender_type="assistant",
                message_text=assistant_text or "",
                audio_url=audio_url,
                processing_time_ms=int(proc_time or 1000),
            ))
        db.add(ApiUsageLogs(
            service_type=service_type or "unknown",
            response_time_ms=int(response_time_ms or 0),
            status=status or "success",
            session_id=int(session_id),
            doctor_id=doctor_id,
            patient_id=patient_id,
            hospital_id=hospital_id,
            tokens_used=tokens_used or 0,
            cost=float(cost or 0.0),
            api_calls=1,
        ))
        
        # Update session stats - Don't await here to avoid nested commits
        try:
            q = (
                update(ConsultationSessions)
                .where(ConsultationSessions.session_id == int(session_id))
                .values(
                    total_tokens_used=ConsultationSessions.total_tokens_used + (tokens_used or 0),
                    total_api_calls=ConsultationSessions.total_api_calls + 1
                )
            )
            await db.execute(q)
        except (DisconnectionError, OperationalError) as e:
            logger.error(f"Database connection error during session stats update in record_turn: {e}")
            await _safe_rollback(db, "consultation_sessions")
            raise DatabaseError("Database connection failed during turn recording", operation="update", table="consultation_sessions", original_error=e)
        
        try:
            await db.commit()
            logger.debug(f"Recorded turn for session {session_id} with service {service_type}")
        except IntegrityError as e:
            logger.error(f"Integrity constraint violation during turn recording: {e}")
            await _safe_rollback(db, "consultation_messages/api_usage_logs")
            raise DatabaseError("Foreign key violation during turn recording", operation="commit", table="consultation_messages/api_usage_logs", original_error=e)
        except (DisconnectionError, OperationalError) as e:
            logger.error(f"Database connection error during turn commit: {e}")
            await _safe_rollback(db, "consultation_messages/api_usage_logs")
            raise DatabaseError("Database connection failed during turn commit", operation="commit", table="consultation_messages/api_usage_logs", original_error=e)
    
    except IntegrityError as e:
        logger.error(f"Integrity error in record_turn: {e}")
        await _safe_rollback(db, "consultation_messages/api_usage_logs")
        raise DatabaseError("Foreign key or constraint violation", operation="insert", table="consultation_messages/api_usage_logs", original_error=e)
    
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database operational error in record_turn: {e}")
        await _safe_rollback(db, "consultation_messages/api_usage_logs")
        raise DatabaseError("Database connection or operational error", operation="insert", table="consultation_messages/api_usage_logs", original_error=e)
    
    except SQLAlchemyDatabaseError as e:
        logger.error(f"SQLAlchemy database error in record_turn: {e}")
        await _safe_rollback(db, "consultation_messages/api_usage_logs")
        raise DatabaseError("Database error during turn recording", operation="insert", table="consultation_messages/api_usage_logs", original_error=e)
    
    except Exception as e:
        logger.error(f"Unexpected error in record_turn: {e}", exc_info=True)
        await _safe_rollback(db, "consultation_messages/api_usage_logs")
        raise DatabaseError("Unexpected error during turn recording", operation="insert", table="consultation_messages/api_usage_logs", original_error=e)


async def get_consultation_details(
    db: AsyncSession,
    *,
    consultation_id: int
) -> Optional[Consultation]:
    """
    Get consultation details by ID
    Returns consultation object or None if not found
    """
    try:
        from sqlalchemy import select
        
        result = await db.execute(
            select(Consultation).where(Consultation.consultation_id == consultation_id)
        )
        consultation = result.scalar_one_or_none()
        
        if not consultation:
            logger.warning(f"Consultation not found: consultation_id={consultation_id}")
        
        return consultation
    except Exception as e:
        logger.error(f"Error fetching consultation details for consultation_id={consultation_id}: {e}")
        return None


async def create_audit(
    db: AsyncSession,
    *,
    event_type: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    user_actor: Optional[int] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    user_agent: Optional[str] = None,
) -> None:
    await _create_audit_log(
        db,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        user_actor=user_actor,
        old_values=old_values,
        new_values=new_values,
        user_agent=user_agent,
    )



async def update_session_stats(
    db: AsyncSession,
    *,
    session_id: int,
    tokens_used: int = 0,
    api_calls: int = 1,
) -> None:
    """Update session with tokens and API call counts"""
    try:
        q = (
            update(ConsultationSessions)
            .where(ConsultationSessions.session_id == int(session_id))
            .values(
                total_tokens_used=ConsultationSessions.total_tokens_used + tokens_used,
                total_api_calls=ConsultationSessions.total_api_calls + api_calls
            )
        )
        
        try:
            await db.execute(q)
        except (DisconnectionError, OperationalError) as e:
            logger.error(f"Database connection error during session stats update: {e}")
            await _safe_rollback(db, "consultation_sessions")
            raise DatabaseError("Database connection failed during stats update", operation="update", table="consultation_sessions", original_error=e)
        
        try:
            await db.commit()
            logger.debug(f"Updated session {session_id} stats: tokens={tokens_used}, api_calls={api_calls}")
        except IntegrityError as e:
            logger.error(f"Integrity constraint violation during stats update: {e}")
            await _safe_rollback(db, "consultation_sessions")
            raise DatabaseError("Data integrity error during stats update", operation="commit", table="consultation_sessions", original_error=e)
    
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database operational error in update_session_stats: {e}")
        await _safe_rollback(db, "consultation_sessions")
        raise DatabaseError("Database connection or operational error", operation="update", table="consultation_sessions", original_error=e)
    
    except SQLAlchemyDatabaseError as e:
        logger.error(f"SQLAlchemy database error in update_session_stats: {e}")
        await _safe_rollback(db, "consultation_sessions")
        raise DatabaseError("Database error during stats update", operation="update", table="consultation_sessions", original_error=e)
    
    except Exception as e:
        logger.error(f"Unexpected error in update_session_stats: {e}", exc_info=True)
        await _safe_rollback(db, "consultation_sessions")
        raise DatabaseError("Unexpected error during stats update", operation="update", table="consultation_sessions", original_error=e)


async def update_consultation_duration(
    db: AsyncSession,
    *,
    consultation_id: int,
) -> None:
    """Calculate and update consultation total duration from session times"""
    try:
        from sqlalchemy import select, func
        
        # Calculate total duration from all sessions
        try:
            result = await db.execute(
                select(func.sum(
                    func.extract('epoch', ConsultationSessions.session_end) - 
                    func.extract('epoch', ConsultationSessions.session_start)
                ).label('total_seconds'))
                .where(
                    ConsultationSessions.consultation_id == int(consultation_id),
                    ConsultationSessions.session_end.isnot(None)
                )
            )
            total_seconds = result.scalar() or 0
        except (DisconnectionError, OperationalError) as e:
            logger.error(f"Database connection error during duration calculation: {e}")
            await _safe_rollback(db, "consultation")
            raise DatabaseError("Database connection failed during duration calculation", operation="select", table="consultation_sessions", original_error=e)
        
        try:
            q = (
                update(Consultation)
                .where(Consultation.consultation_id == int(consultation_id))
                .values(total_duration=int(total_seconds))
            )
            await db.execute(q)
        except (DisconnectionError, OperationalError) as e:
            logger.error(f"Database connection error during duration update: {e}")
            await _safe_rollback(db, "consultation")
            raise DatabaseError("Database connection failed during duration update", operation="update", table="consultation", original_error=e)
        
        try:
            await db.commit()
            logger.info(f"Updated consultation {consultation_id} duration to {int(total_seconds)} seconds")
        except IntegrityError as e:
            logger.error(f"Integrity constraint violation during duration update: {e}")
            await _safe_rollback(db, "consultation")
            raise DatabaseError("Data integrity error during duration update", operation="commit", table="consultation", original_error=e)
    
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database operational error in update_consultation_duration: {e}")
        await _safe_rollback(db, "consultation")
        raise DatabaseError("Database connection or operational error", operation="update", table="consultation", original_error=e)
    
    except SQLAlchemyDatabaseError as e:
        logger.error(f"SQLAlchemy database error in update_consultation_duration: {e}")
        await _safe_rollback(db, "consultation")
        raise DatabaseError("Database error during duration update", operation="update", table="consultation", original_error=e)
    
    except Exception as e:
        logger.error(f"Unexpected error in update_consultation_duration: {e}", exc_info=True)
        await _safe_rollback(db, "consultation")
        raise DatabaseError("Unexpected error during duration update", operation="update", table="consultation", original_error=e)


async def log_conversation_apis(
    db: AsyncSession,
    consultation_id: int,
    session_db_id: int,
    openai_tokens: tuple,
    openai_latency: int,
    translation_data: tuple = None,
    rag_data: tuple = None
) -> None:
    """Log all APIs used in text conversation"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        from sqlalchemy import select
        from models.models import Consultation
        from service.analytics_service import log_openai_chat, log_sarvam_translation, log_rag_retrieval
        
        consultation_result = await db.execute(
            select(Consultation).where(Consultation.consultation_id == consultation_id)
        )
        consultation = consultation_result.scalar_one_or_none()
        
        if not consultation:
            logger.warning(f"Consultation {consultation_id} not found for API logging")
            return
        
        try:
            await log_openai_chat(
                db=db,
                input_tokens=openai_tokens[0],
                output_tokens=openai_tokens[1],
                response_time_ms=openai_latency,
                session_id=session_db_id,
                doctor_id=consultation.doctor_id,
                patient_id=consultation.patient_id,
                hospital_id=consultation.hospital_id
            )
        except Exception as e:
            logger.error(f"Failed to log OpenAI chat: {e}")
        
        if translation_data:
            try:
                await log_sarvam_translation(
                    db=db,
                    input_length=translation_data[0],
                    output_length=translation_data[1],
                    response_time_ms=translation_data[2],
                    session_id=session_db_id,
                    doctor_id=consultation.doctor_id,
                    patient_id=consultation.patient_id,
                    hospital_id=consultation.hospital_id
                )
            except Exception as e:
                logger.error(f"Failed to log translation: {e}")
        
        if rag_data:
            try:
                await log_rag_retrieval(
                    db=db,
                    context_length=rag_data[0],
                    response_time_ms=rag_data[1],
                    session_id=session_db_id,
                    doctor_id=consultation.doctor_id,
                    patient_id=consultation.patient_id,
                    hospital_id=consultation.hospital_id
                )
            except Exception as e:
                logger.error(f"Failed to log RAG retrieval: {e}")
    except Exception as e:
        logger.error(f"Failed to log conversation APIs: {e}")
        # Don't raise - allow the request to continue


async def log_speech_apis(
    db: AsyncSession,
    consultation_id: int,
    session_db_id: int,
    stt_provider: str,
    stt_data: tuple,
    openai_tokens: tuple,
    openai_latency: int,
    translation_data: tuple = None,
    rag_data: tuple = None
) -> None:
    """Log all APIs used in speech conversation"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        from sqlalchemy import select
        from models.models import Consultation
        from service.analytics_service import (
            log_deepgram_stt, log_sarvam_stt, log_openai_chat,
            log_sarvam_translation, log_rag_retrieval
        )
        
        consultation_result = await db.execute(
            select(Consultation).where(Consultation.consultation_id == consultation_id)
        )
        consultation = consultation_result.scalar_one_or_none()
        
        if not consultation:
            logger.warning(f"Consultation {consultation_id} not found for speech API logging")
            return
        
        # Log STT
        try:
            if stt_provider == "deepgram":
                await log_deepgram_stt(
                    db=db,
                    audio_duration_sec=stt_data[0],
                    response_time_ms=stt_data[1],
                    transcript=stt_data[2],
                    session_id=session_db_id,
                    doctor_id=consultation.doctor_id,
                    patient_id=consultation.patient_id,
                    hospital_id=consultation.hospital_id
                )
            elif stt_provider == "sarvam":
                await log_sarvam_stt(
                    db=db,
                    audio_duration_sec=stt_data[0],
                    response_time_ms=stt_data[1],
                    transcript=stt_data[2],
                    session_id=session_db_id,
                    doctor_id=consultation.doctor_id,
                    patient_id=consultation.patient_id,
                    hospital_id=consultation.hospital_id
                )
        except Exception as e:
            logger.error(f"Failed to log STT ({stt_provider}): {e}")
        
        # Log OpenAI
        try:
            await log_openai_chat(
                db=db,
                input_tokens=openai_tokens[0],
                output_tokens=openai_tokens[1],
                response_time_ms=openai_latency,
                session_id=session_db_id,
                doctor_id=consultation.doctor_id,
                patient_id=consultation.patient_id,
                hospital_id=consultation.hospital_id
            )
        except Exception as e:
            logger.error(f"Failed to log OpenAI chat: {e}")
        
        # Log translation
        if translation_data:
            try:
                await log_sarvam_translation(
                    db=db,
                    input_length=translation_data[0],
                    output_length=translation_data[1],
                    response_time_ms=translation_data[2],
                    session_id=session_db_id,
                    doctor_id=consultation.doctor_id,
                    patient_id=consultation.patient_id,
                    hospital_id=consultation.hospital_id
                )
            except Exception as e:
                logger.error(f"Failed to log translation: {e}")
        
        # Log RAG
        if rag_data:
            try:
                await log_rag_retrieval(
                    db=db,
                    context_length=rag_data[0],
                    response_time_ms=rag_data[1],
                    session_id=session_db_id,
                    doctor_id=consultation.doctor_id,
                    patient_id=consultation.patient_id,
                    hospital_id=consultation.hospital_id
                )
            except Exception as e:
                logger.error(f"Failed to log RAG retrieval: {e}")
    except Exception as e:
        logger.error(f"Failed to log speech APIs: {e}")
        # Don't raise - allow the request to continue


async def log_tts_api(
    consultation_id: int,
    session_id: str,
    provider: str,
    text_length: int,
    audio_size: int,
    response_time_ms: int
) -> None:
    """Log TTS API usage with production-level error handling"""
    try:
        from database.database import AsyncSessionLocal
        from sqlalchemy import select
        from models.models import Consultation
        from service.analytics_service import log_deepgram_tts, log_sarvam_tts
        
        try:
            async with AsyncSessionLocal() as db:
                try:
                    session_db_id = await get_or_create_session(db, consultation_id=consultation_id, session_type="tts")
                except (DisconnectionError, OperationalError) as e:
                    logger.error(f"Database connection error while creating TTS session: {e}")
                    raise DatabaseError("Database connection failed during TTS session creation", operation="insert", table="consultation_sessions", original_error=e)
                
                try:
                    consultation_result = await db.execute(
                        select(Consultation).where(Consultation.consultation_id == consultation_id)
                    )
                    consultation = consultation_result.scalar_one_or_none()
                except (DisconnectionError, OperationalError) as e:
                    logger.error(f"Database connection error while fetching consultation for TTS logging: {e}")
                    raise DatabaseError("Database connection failed during consultation fetch", operation="select", table="consultation", original_error=e)
                
                if not consultation:
                    logger.warning(f"Consultation {consultation_id} not found for TTS API logging")
                    return
                
                try:
                    if provider in ["deepgram", "deepgram-nova3"]:
                        await log_deepgram_tts(
                            db=db,
                            text_length=text_length,
                            audio_size=audio_size,
                            response_time_ms=response_time_ms,
                            session_id=session_db_id,
                            doctor_id=consultation.doctor_id,
                            patient_id=consultation.patient_id,
                            hospital_id=consultation.hospital_id
                        )
                    else:
                        await log_sarvam_tts(
                            db=db,
                            text_length=text_length,
                            audio_size=audio_size,
                            response_time_ms=response_time_ms,
                            session_id=session_db_id,
                            doctor_id=consultation.doctor_id,
                            patient_id=consultation.patient_id,
                            hospital_id=consultation.hospital_id
                        )
                    logger.debug(f"Logged TTS API usage for consultation {consultation_id} using {provider}")
                except (DisconnectionError, OperationalError) as e:
                    logger.error(f"Database connection error while logging TTS usage: {e}")
                    raise DatabaseError("Database connection failed during TTS logging", operation="insert", table="api_usage_logs", original_error=e)
        except (DisconnectionError, OperationalError) as e:
            logger.error(f"Database session creation error in log_tts_api: {e}")
            raise DatabaseError("Database session creation failed", operation="session", table="api_usage_logs", original_error=e)
    
    except IntegrityError as e:
        logger.error(f"Integrity error in log_tts_api: {e}")
        raise DatabaseError("Foreign key or constraint violation", operation="insert", table="api_usage_logs", original_error=e)
    
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database operational error in log_tts_api: {e}")
        raise DatabaseError("Database connection or operational error", operation="insert", table="api_usage_logs", original_error=e)
    
    except SQLAlchemyDatabaseError as e:
        logger.error(f"SQLAlchemy database error in log_tts_api: {e}")
        raise DatabaseError("Database error during TTS logging", operation="insert", table="api_usage_logs", original_error=e)
    
    except Exception as e:
        logger.error(f"Unexpected error in log_tts_api: {e}", exc_info=True)
        raise DatabaseError("Unexpected error during TTS logging", operation="insert", table="api_usage_logs", original_error=e)

# Function removed - use close_session directly with better error handling in routes