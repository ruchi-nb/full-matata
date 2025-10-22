from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.exc import (
    IntegrityError,
    OperationalError,
    DisconnectionError,
    InvalidRequestError
)
from models.models import Users, UserDetails, DoctorSpecialties, Specialties, Consultation
from centralisedErrorHandling.ErrorHandling import (
    DatabaseError,
    ValidationError,
    UserNotFoundError,
    DataIntegrityError,
    ConnectionError,
    TransactionError
)
import logging
from datetime import datetime, date

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


async def get_doctor_profile(db: AsyncSession, user_id: int) -> Tuple[Users, Optional[UserDetails]]:
    try:
        user = await db.get(Users, int(user_id))
        if not user:
            raise UserNotFoundError(user_id=user_id)
        details = await db.get(UserDetails, int(user_id))
        return user, details
    except UserNotFoundError:
        raise
    except Exception as e:
        raise DatabaseError("Failed to fetch doctor profile", operation="select", table="users/user_details", original_error=e)


async def update_doctor_profile(db: AsyncSession, user_id: int, updates: Dict[str, Any]) -> Tuple[Users, Optional[UserDetails]]:
    try:
        logger.info(f"Updating doctor profile for user_id={user_id} with updates: {updates}")
        
        user = await db.get(Users, int(user_id))
        if not user:
            raise UserNotFoundError(user_id=user_id)
        
        details = await db.get(UserDetails, int(user_id))
        if not details:
            logger.info(f"Creating new UserDetails for user_id={user_id}")
            details = UserDetails(user_id=int(user_id))
            db.add(details)
        
        allowed_user = {"username", "email"}
        changed = False
        
        # Update user fields
        for k, v in (updates or {}).items():
            if k in allowed_user and v is not None and getattr(user, k) != v:
                logger.info(f"Updating user.{k}: {getattr(user, k)} -> {v}")
                setattr(user, k, v)
                changed = True
        
        # Update user_details fields
        allowed_details = {"first_name", "last_name", "phone", "dob", "gender", "address"}
        for k, v in (updates or {}).items():
            if k in allowed_details:
                current_value = getattr(details, k, None)
                
                # Special handling for dob field - convert string to date
                if k == "dob" and v is not None and isinstance(v, str):
                    try:
                        v = datetime.fromisoformat(v.replace('Z', '+00:00')).date()
                        logger.info(f"Converted dob string to date: {v}")
                    except (ValueError, AttributeError) as e:
                        logger.warning(f"Failed to convert dob '{v}' to date: {e}")
                        continue
                
                # Check if value has actually changed
                if current_value != v:
                    logger.info(f"Updating details.{k}: {current_value} -> {v}")
                    setattr(details, k, v)
                    changed = True
        
        if changed:
            db.add(user)
            db.add(details)
            await db.commit()
            await db.refresh(user)
            await db.refresh(details)
            logger.info(f"✅ Successfully updated doctor profile for user_id={user_id}")
        else:
            logger.info(f"No changes detected for user_id={user_id}")
        
        return user, details
    except UserNotFoundError:
        raise
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "users/user_details")
        logger.error(f"❌ Unexpected error in update_doctor_profile: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to update doctor profile",
            operation="update",
            table="users/user_details",
            original_error=e,
            context={"user_id": user_id}
        )


async def list_doctor_specialties(db: AsyncSession, user_id: int) -> List[Specialties]:
    try:
        q = (
            select(Specialties)
            .join(DoctorSpecialties, DoctorSpecialties.specialty_id == Specialties.specialty_id)
            .where(DoctorSpecialties.user_id == int(user_id))
            .order_by(Specialties.name)
        )
        res = await db.execute(q)
        return list(res.scalars().all())
    except Exception as e:
        raise DatabaseError("Failed to list doctor specialties", operation="select", table="doctor_specialties/specialties", original_error=e)


async def assign_doctor_specialties(db: AsyncSession, user_id: int, specialty_ids: List[int]) -> List[Specialties]:
    try:
        # fetch existing
        existing_q = select(DoctorSpecialties).where(DoctorSpecialties.user_id == int(user_id))
        res = await db.execute(existing_q)
        existing = {int(ds.specialty_id): ds for ds in res.scalars().all()}
        keep = set(int(s) for s in (specialty_ids or []))

        # delete removed
        for sid, row in list(existing.items()):
            if sid not in keep:
                await db.delete(row)
        # add new
        for sid in keep:
            if sid not in existing:
                db.add(DoctorSpecialties(user_id=int(user_id), specialty_id=int(sid)))

        await db.commit()

        return await list_doctor_specialties(db, user_id)
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "doctor_specialties")
        logger.error(f"Unexpected error in assign_doctor_specialties: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to assign doctor specialties",
            operation="upsert",
            table="doctor_specialties",
            original_error=e,
            context={"user_id": user_id, "specialty_count": len(specialty_ids) if specialty_ids else 0}
        )


async def list_patients_for_doctor(db: AsyncSession, doctor_id: int, limit: int = 200) -> List[Users]:
    try:
        q = (
            select(Users)
            .join(Consultation, Consultation.patient_id == Users.user_id)
            .where(Consultation.doctor_id == int(doctor_id))
            .group_by(Users.user_id)
            .order_by(desc(func.max(Consultation.consultation_date)))
            .limit(int(limit))
        )
        res = await db.execute(q)
        return list(res.scalars().all())
    except Exception as e:
        raise DatabaseError("Failed to list doctor patients", operation="select", table="users/consultation", original_error=e)


async def get_patient_details(db: AsyncSession, patient_id: int) -> Tuple[Users, Optional[UserDetails]]:
    try:
        user = await db.get(Users, int(patient_id))
        if not user:
            raise UserNotFoundError(user_id=patient_id)
        details = await db.get(UserDetails, int(patient_id))
        return user, details
    except UserNotFoundError:
        raise
    except Exception as e:
        raise DatabaseError("Failed to fetch patient details", operation="select", table="users/user_details", original_error=e)


async def list_patient_consultations_for_doctor(db: AsyncSession, doctor_id: int, patient_id: int, limit: int = 200) -> List[Consultation]:
    try:
        q = (
            select(Consultation)
            .where(Consultation.doctor_id == int(doctor_id), Consultation.patient_id == int(patient_id))
            .order_by(desc(Consultation.consultation_date))
            .limit(int(limit))
        )
        res = await db.execute(q)
        return list(res.scalars().all())
    except Exception as e:
        raise DatabaseError("Failed to list consultations", operation="select", table="consultation", original_error=e)


async def analytics_patients(db: AsyncSession, doctor_id: int) -> Dict[str, Any]:
    try:
        total_consults = await db.execute(select(func.count()).select_from(Consultation).where(Consultation.doctor_id == int(doctor_id)))
        total_patients = await db.execute(
            select(func.count(func.distinct(Consultation.patient_id))).where(Consultation.doctor_id == int(doctor_id))
        )
        return {
            "total_consultations": int(total_consults.scalar() or 0),
            "total_unique_patients": int(total_patients.scalar() or 0),
        }
    except Exception as e:
        raise DatabaseError("Failed to compute analytics", operation="aggregate", table="consultation", original_error=e)


async def consultations_monthly(db: AsyncSession, doctor_id: int) -> List[Dict[str, Any]]:
    try:
        q = (
            select(
                func.date_format(Consultation.consultation_date, "%Y-%m").label("month"),
                func.count().label("count"),
            )
            .where(Consultation.doctor_id == int(doctor_id))
            .group_by("month")
            .order_by("month")
        )
        res = await db.execute(q)
        rows = res.all()
        return [{"month": r[0], "count": int(r[1] or 0)} for r in rows]
    except Exception as e:
        raise DatabaseError("Failed to compute monthly consultations", operation="aggregate", table="consultation", original_error=e)


