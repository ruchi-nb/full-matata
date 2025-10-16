from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import (
    IntegrityError,
    OperationalError,
    DisconnectionError,
    InvalidRequestError
)
from models.models import AuditLogs
from centralisedErrorHandling.ErrorHandling import (
    DatabaseError,
    DataIntegrityError,
    ConnectionError,
    TransactionError
)
import logging

logger = logging.getLogger(__name__)


async def _safe_rollback(db: AsyncSession, context: str) -> None:
    """Safely attempt database rollback with error handling"""
    try:
        await db.rollback()
        logger.debug(f"Successfully rolled back audit log transaction for {context}")
    except InvalidRequestError as e:
        logger.debug(f"Rollback skipped - no transaction active for {context}: {e}")
    except (DisconnectionError, OperationalError) as e:
        logger.warning(f"Database connection lost during audit rollback for {context}: {e}")
    except Exception as e:
        logger.warning(f"Unexpected error during audit rollback for {context}: {e}")


async def create_audit_log(
    db: AsyncSession,
    *,
    event_type: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    user_actor: Optional[int] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    user_agent: Optional[str] = None,
) -> None:
    """
    Best-effort audit logging - errors are logged but not raised
    to avoid failing the main operation
    """
    try:
        row = AuditLogs(
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            user_actor=user_actor,
            old_values=old_values,
            new_values=new_values,
            user_agent=user_agent,
        )
        db.add(row)
        
        # Flush with explicit exception handling (best-effort)
        try:
            await db.flush()
        except IntegrityError as e:
            logger.warning(f"Audit log integrity error during flush (best-effort): {e}", extra={
                "event_type": event_type,
                "entity_type": entity_type,
                "entity_id": entity_id
            })
            await _safe_rollback(db, "audit_logs")
            return  # Best-effort: return without raising
        except (DisconnectionError, OperationalError) as e:
            logger.warning(f"Audit log connection error during flush (best-effort): {e}", extra={
                "event_type": event_type,
                "entity_type": entity_type
            })
            await _safe_rollback(db, "audit_logs")
            return  # Best-effort: return without raising
        except InvalidRequestError as e:
            logger.warning(f"Audit log session error during flush (best-effort): {e}", extra={
                "event_type": event_type
            })
            await _safe_rollback(db, "audit_logs")
            return  # Best-effort: return without raising
        
        # Refresh with explicit exception handling (best-effort)
        try:
            await db.refresh(row)
        except (InvalidRequestError, DisconnectionError, OperationalError) as e:
            logger.warning(f"Audit log refresh error (best-effort): {e}")
            await _safe_rollback(db, "audit_logs")
            return  # Best-effort: return without raising
        
        await db.commit()
        logger.debug(f"Audit log created: {event_type} for {entity_type}:{entity_id}")
        
    except Exception as e:
        # Best-effort: swallow errors to avoid failing the main operation
        logger.warning(f"Unexpected error creating audit log (best-effort): {e}", extra={
            "event_type": event_type,
            "entity_type": entity_type,
            "entity_id": entity_id
        })
        await _safe_rollback(db, "audit_logs")


