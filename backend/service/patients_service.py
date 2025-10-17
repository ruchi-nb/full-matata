from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.exc import (
    IntegrityError,
    OperationalError,
    DisconnectionError,
    InvalidRequestError
)
from models.models import Users, UserDetails, PatientHospitals, Consultation, RoleMaster
from schema.schema import RegisterPatientIn
from utils.utils import generate_passwd_hash
from utils.validators import validate_username, validate_email, validate_password, validate_phone
from centralisedErrorHandling.ErrorHandling import (
    ValidationError,
    DatabaseError,
    UserNotFoundError,
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
        logger.info(f"Successfully rolled back transaction for {context}")
    except InvalidRequestError as e:
        logger.warning(f"Rollback skipped - no transaction active for {context}: {e}")
    except (DisconnectionError, OperationalError) as e:
        logger.error(f"Database connection lost during rollback for {context}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during rollback for {context}: {e}", exc_info=True)



async def create_patient(db: AsyncSession, payload: RegisterPatientIn) -> Users:
    try:
        username = validate_username(payload.username)
        email = validate_email(payload.email)
        password = validate_password(payload.password)
        phone = validate_phone(payload.phone, required=False)
    except ValidationError as ve:
        raise ve

    q = select(Users).where((Users.email == email) | (Users.username == username))
    try:
        res = await db.execute(q)
        existing = res.scalars().first()
    except Exception as e:
        raise DatabaseError("Failed to query existing users", operation="select", table="users", original_error=e)

    if existing:
        raise ValidationError("A user with that email or username already exists")

    try:
        role_q = select(RoleMaster).where(RoleMaster.role_name == "patient")
        role_res = await db.execute(role_q)
        patient_role = role_res.scalar_one_or_none()
    except Exception as e:
        raise DatabaseError("Failed to find patient role", operation="select", table="role_master", original_error=e)

    if not patient_role:
        raise DatabaseError("Patient role not found in system", operation="select", table="role_master")

    user = Users(
        username=username,
        email=email,
        password_hash=generate_passwd_hash(password),
        global_role_id=patient_role.role_id,
    )
    try:
        db.add(user)
        
        # Flush with explicit exception handling
        try:
            await db.flush()
        except IntegrityError as e:
            await _safe_rollback(db, "users")
            logger.error(f"Integrity error during patient flush: {e}")
            raise DataIntegrityError(
                "Duplicate email or username",
                constraint_type="unique",
                table="users",
                field="email/username",
                value={"email": email, "username": username},
                original_error=e,
                context={"operation": "create_patient_flush"}
            )
        except (DisconnectionError, OperationalError) as e:
            await _safe_rollback(db, "users")
            logger.error(f"Database connection error during patient flush: {e}")
            raise ConnectionError(
                "Database connection failed during patient creation",
                operation="create_patient_flush",
                original_error=e,
                context={"table": "users", "email": email}
            )
        except InvalidRequestError as e:
            await _safe_rollback(db, "users")
            logger.error(f"Invalid session state during patient flush: {e}")
            raise TransactionError(
                "Session state error during patient creation",
                operation="create_patient_flush",
                table="users",
                transaction_state="flush_failed",
                original_error=e,
                context={"email": email}
            )
        
        # Refresh with explicit exception handling
        try:
            await db.refresh(user)
        except InvalidRequestError as e:
            await _safe_rollback(db, "users")
            logger.error(f"Invalid session state during patient refresh: {e}")
            raise TransactionError(
                "Session state error during patient refresh",
                operation="create_patient_refresh",
                table="users",
                transaction_state="refresh_failed",
                original_error=e,
                context={"email": email}
            )
        except (DisconnectionError, OperationalError) as e:
            await _safe_rollback(db, "users")
            logger.error(f"Database connection error during patient refresh: {e}")
            raise ConnectionError(
                "Database connection failed during patient refresh",
                operation="create_patient_refresh",
                original_error=e,
                context={"table": "users", "email": email}
            )

        details = UserDetails(
            user_id=int(user.user_id),
            first_name=payload.first_name,
            last_name=payload.last_name,
            phone=phone,
        )
        db.add(details)

        if payload.hospital_id and payload.hospital_id > 0:
            ph = PatientHospitals(user_id=int(user.user_id), hospital_id=int(payload.hospital_id))
            db.add(ph)

        await db.commit()
        await db.refresh(user)
        return user
        
    except (ValidationError, DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "users")
        logger.error(f"Unexpected error in create_patient: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to create patient",
            operation="insert",
            table="users",
            original_error=e,
            context={"email": email, "username": username}
        )

async def get_patient_profile(db: AsyncSession, user_id: int) -> Optional[UserDetails]:

    try:
        details = await db.get(UserDetails, int(user_id))
        return details
    except Exception as e:
        raise DatabaseError("Failed to fetch user details", operation="select", table="user_details", original_error=e)


async def update_patient_profile(db: AsyncSession, user_id: int, update_data: Dict[str, Any]) -> UserDetails:

    try:
        details = await db.get(UserDetails, int(user_id))
    except Exception as e:
        raise DatabaseError("Failed to fetch profile", operation="select", table="user_details", original_error=e)

    if not details:
        raise UserNotFoundError("Profile not found", user_id=user_id)

    allowed = {"first_name", "last_name", "phone", "dob", "gender", "address"}
    changed = False
    for k, v in update_data.items():
        if k in allowed and getattr(details, k) != v:
            setattr(details, k, v)
            changed = True

    if not changed:
        return details

    try:
        db.add(details)
        await db.commit()
        await db.refresh(details)
        return details
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "user_details")
        logger.error(f"Unexpected error in update_patient_profile: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to update profile",
            operation="update",
            table="user_details",
            original_error=e,
            context={"user_id": user_id}
        )

async def list_patient_consultations(db: AsyncSession, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:

    try:
        q = (
            select(Consultation)
            .where(Consultation.patient_id == int(user_id))
            .order_by(desc(Consultation.consultation_date))
            .limit(int(limit))
        )
        res = await db.execute(q)
        consultations = res.scalars().all()
    except Exception as e:
        raise DatabaseError("Failed to list consultations", operation="select", table="consultation", original_error=e)

    return [{
        "consultation_id": int(consultation.consultation_id),
        "doctor_id": int(consultation.doctor_id) if consultation.doctor_id is not None else None,
        "hospital_id": int(consultation.hospital_id) if consultation.hospital_id is not None else None,
        "specialty_id": int(consultation.specialty_id) if consultation.specialty_id is not None else None,
        "consultation_date": consultation.consultation_date.isoformat() if consultation.consultation_date else None,
        "status": consultation.status,
        "total_duration": int(consultation.total_duration or 0),
    } for consultation in consultations]

