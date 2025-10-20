from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.exc import (
    IntegrityError,
    OperationalError,
    DisconnectionError,
    InvalidRequestError
)
from models.models import HospitalMaster, Specialties, Users, HospitalUserRoles, DoctorSpecialties
from centralisedErrorHandling.ErrorHandling import (
    DatabaseError,
    ValidationError,
    DataIntegrityError,
    ConnectionError,
    TransactionError,
    ResourceNotFoundError
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


async def get_hospital_profile(db: AsyncSession, hospital_id: int) -> Optional[HospitalMaster]:
    try:
        row = await db.get(HospitalMaster, int(hospital_id))
        return row
    except Exception as e:
        raise DatabaseError("Failed to fetch hospital profile", operation="select", table="hospital_master", original_error=e)


async def update_hospital_profile(db: AsyncSession, hospital_id: int, update_data: Dict[str, Any]) -> HospitalMaster:
    try:
        hospital: Optional[HospitalMaster] = await db.get(HospitalMaster, int(hospital_id))
    except Exception as e:
        raise DatabaseError("Failed to fetch hospital", operation="select", table="hospital_master", original_error=e)

    if not hospital:
        raise ValidationError("Hospital not found", field="hospital_id", value=hospital_id)

    allowed = {"hospital_name", "hospital_email", "admin_contact", "address"}
    changed = False
    for k, v in (update_data or {}).items():
        if k in allowed and getattr(hospital, k) != v:
            setattr(hospital, k, v)
            changed = True

    if not changed:
        return hospital

    try:
        db.add(hospital)
        await db.commit()
        await db.refresh(hospital)
        return hospital
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "hospital_master")
        logger.error(f"Unexpected error in update_hospital_profile: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to update hospital profile",
            operation="update",
            table="hospital_master",
            original_error=e,
            context={"hospital_id": hospital_id}
        )


async def list_specialities(db: AsyncSession, limit: int = 500) -> List[Specialties]:
    try:
        q = select(Specialties).limit(int(limit))
        res = await db.execute(q)
        return list(res.scalars().all())
    except Exception as e:
        raise DatabaseError("Failed to list specialties", operation="select", table="specialties", original_error=e)


async def create_speciality(db: AsyncSession, *, name: str, description: Optional[str] = None, status: Optional[str] = "active") -> Specialties:
    if not name or not isinstance(name, str) or not name.strip():
        raise ValidationError("name is required", field="name")

    new_row = Specialties(name=name.strip(), description=description, status=status or "active")
    try:
        db.add(new_row)
        await db.commit()
        await db.refresh(new_row)
        return new_row
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "specialties")
        logger.error(f"Unexpected error in create_speciality: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to create specialty",
            operation="insert",
            table="specialties",
            original_error=e,
            context={"name": name}
        )


async def update_speciality(db: AsyncSession, specialty_id: int, *, name: Optional[str] = None, description: Optional[str] = None, status: Optional[str] = None) -> Specialties:
    try:
        row: Optional[Specialties] = await db.get(Specialties, int(specialty_id))
    except Exception as e:
        raise DatabaseError("Failed to fetch specialty", operation="select", table="specialties", original_error=e)

    if not row:
        raise ValidationError("Specialty not found", field="specialty_id", value=specialty_id)

    changed = False
    if name is not None and name.strip() and row.name != name.strip():
        row.name = name.strip()
        changed = True
    if description is not None and row.description != description:
        row.description = description
        changed = True
    if status is not None and row.status != status:
        row.status = status
        changed = True

    if not changed:
        return row

    try:
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return row
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "specialties")
        logger.error(f"Unexpected error in update_speciality: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to update specialty",
            operation="update",
            table="specialties",
            original_error=e,
            context={"specialty_id": specialty_id}
        )


async def delete_speciality(db: AsyncSession, specialty_id: int) -> None:
    try:
        row: Optional[Specialties] = await db.get(Specialties, int(specialty_id))
    except Exception as e:
        raise DatabaseError("Failed to fetch specialty", operation="select", table="specialties", original_error=e)

    if not row:
        # treat as idempotent delete
        return

    try:
        await db.delete(row)
        await db.commit()
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "specialties")
        logger.error(f"Unexpected error in delete_speciality: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to delete specialty",
            operation="delete",
            table="specialties",
            original_error=e,
            context={"specialty_id": specialty_id}
        )


# -----------------------------
# Doctor lifecycle (hospital)
# -----------------------------

async def add_doctor_to_hospital(
    db: AsyncSession,
    *,
    hospital_id: int,
    doctor_user_id: int,
    hospital_role_id: Optional[int] = None,
) -> HospitalUserRoles:
    try:
        user = await db.get(Users, int(doctor_user_id))
    except Exception as e:
        raise DatabaseError("Failed to fetch user", operation="select", table="users", original_error=e)
    if not user:
        raise ValidationError("Doctor user not found", field="doctor_user_id", value=doctor_user_id)

    if hospital_role_id is None:
        raise ValidationError("hospital_role_id is required", field="hospital_role_id")

    try:
        # If a mapping for user and hospital exists with any role, keep a single active mapping; update role if provided
        q = select(HospitalUserRoles).where(
            and_(
                HospitalUserRoles.hospital_id == int(hospital_id),
                HospitalUserRoles.user_id == int(doctor_user_id),
            )
        )
        res = await db.execute(q)
        hur = res.scalars().first()
        if hur:
            if hospital_role_id is not None:
                hur.hospital_role_id = int(hospital_role_id)
            hur.is_active = 1
            db.add(hur)
            await db.commit()
            await db.refresh(hur)
            return hur

        # create new mapping
        new_hur = HospitalUserRoles(
            hospital_id=int(hospital_id),
            user_id=int(doctor_user_id),
            hospital_role_id=int(hospital_role_id),
            is_active=1,
        )
        db.add(new_hur)
        await db.commit()
        await db.refresh(new_hur)
        return new_hur
    except (ValidationError, DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "hospital_user_roles")
        logger.error(f"Unexpected error in add_doctor_to_hospital: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to add doctor to hospital",
            operation="insert",
            table="hospital_user_roles",
            original_error=e,
            context={"hospital_id": hospital_id, "doctor_user_id": doctor_user_id, "hospital_role_id": hospital_role_id}
        )


async def update_doctor_in_hospital(
    db: AsyncSession,
    *,
    hospital_id: int,
    doctor_user_id: int,
    update_fields: Dict[str, Any],
    new_hospital_role_id: Optional[int] = None,
    specialty_ids: Optional[List[int]] = None,
) -> Users:
    try:
        user = await db.get(Users, int(doctor_user_id))
    except Exception as e:
        raise DatabaseError("Failed to fetch user", operation="select", table="users", original_error=e)
    if not user:
        raise ValidationError("Doctor not found", field="doctor_user_id", value=doctor_user_id)

    try:
        # Update mapping role if provided
        if new_hospital_role_id is not None:
            q = select(HospitalUserRoles).where(
                and_(
                    HospitalUserRoles.hospital_id == int(hospital_id),
                    HospitalUserRoles.user_id == int(doctor_user_id),
                )
            )
            res = await db.execute(q)
            hur = res.scalars().first()
            if not hur:
                hur = HospitalUserRoles(
                    hospital_id=int(hospital_id),
                    user_id=int(doctor_user_id),
                    hospital_role_id=int(new_hospital_role_id),
                    is_active=1,
                )
            else:
                hur.hospital_role_id = int(new_hospital_role_id)
                hur.is_active = 1
            db.add(hur)

        # Update specialties if provided: upsert provided and remove others for the doctor
        if specialty_ids is not None:
            # Fetch existing for doctor
            q = select(DoctorSpecialties).where(DoctorSpecialties.user_id == int(doctor_user_id))
            res = await db.execute(q)
            existing = {int(ds.specialty_id): ds for ds in res.scalars().all()}
            keep = set(int(s) for s in specialty_ids)
            # delete removed
            for sid, row in list(existing.items()):
                if sid not in keep:
                    await db.delete(row)
            # add new
            for sid in keep:
                if sid not in existing:
                    db.add(DoctorSpecialties(user_id=int(doctor_user_id), specialty_id=int(sid)))

        # Update basic fields on Users (only username/email allowed here)
        allowed = {"username", "email"}
        changed = False
        for k, v in (update_fields or {}).items():
            if k in allowed and getattr(user, k) != v and v is not None:
                setattr(user, k, v)
                changed = True
        if changed:
            db.add(user)

        await db.commit()
        await db.refresh(user)
        return user
    except (ValidationError, DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "users/hospital_user_roles/doctor_specialties")
        logger.error(f"Unexpected error in update_doctor_in_hospital: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to update doctor",
            operation="update",
            table="users/hospital_user_roles/doctor_specialties",
            original_error=e,
            context={"hospital_id": hospital_id, "doctor_user_id": doctor_user_id}
        )


async def remove_doctor_from_hospital(db: AsyncSession, *, hospital_id: int, doctor_user_id: int) -> None:
    try:
        q = select(HospitalUserRoles).where(
            and_(
                HospitalUserRoles.hospital_id == int(hospital_id),
                HospitalUserRoles.user_id == int(doctor_user_id),
            )
        )
        res = await db.execute(q)
        hur = res.scalars().first()
        if not hur:
            return
        await db.delete(hur)
        await db.commit()
    except (DataIntegrityError, ConnectionError, TransactionError):
        raise
    except Exception as e:
        await _safe_rollback(db, "hospital_user_roles")
        logger.error(f"Unexpected error in remove_doctor_from_hospital: {e}", exc_info=True)
        raise DatabaseError(
            "Failed to remove doctor from hospital",
            operation="delete",
            table="hospital_user_roles",
            original_error=e,
            context={"hospital_id": hospital_id, "doctor_user_id": doctor_user_id}
        )


async def list_hospital_doctors(db: AsyncSession, *, hospital_id: int, limit: int = 500) -> List[Users]:
    """
    List doctors for a specific hospital using the RBAC system (hospital_user_roles + hospital_role).
    Only returns users who have the 'doctor' role assigned in hospital_user_roles.
    """
    try:
        from models.models import HospitalRole
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"🔍 Listing doctors for hospital_id: {hospital_id}")
        
        # Get user IDs with doctor role OR custom roles (excluding patient and hospital_admin)
        # Custom roles are treated as staff/doctor-level access
        user_ids_query = (
            select(HospitalUserRoles.user_id)
            .join(HospitalRole, HospitalRole.hospital_role_id == HospitalUserRoles.hospital_role_id)
            .where(
                and_(
                    HospitalUserRoles.hospital_id == int(hospital_id),
                    HospitalUserRoles.is_active == 1,
                    # Include 'doctor' role and custom roles (exclude patient and hospital_admin)
                    HospitalRole.role_name.notin_(['patient', 'hospital_admin'])
                )
            )
            .distinct()
        )
        
        logger.info(f"🔍 Executing user_ids query for hospital_id: {hospital_id}")
        user_ids_res = await db.execute(user_ids_query)
        user_ids = [row[0] for row in user_ids_res.fetchall()]
        
        if not user_ids:
            logger.info(f"🔍 No doctor user IDs found for hospital_id: {hospital_id}")
            return []
        
        logger.info(f"🔍 Found doctor user IDs: {user_ids}")
        
        # Now get the Users objects for these IDs
        users_query = select(Users).where(Users.user_id.in_(user_ids)).limit(int(limit))
        users_res = await db.execute(users_query)
        doctors = list(users_res.scalars().all())
        
        logger.info(f"🔍 Found {len(doctors)} doctors for hospital_id: {hospital_id}")
        
        return doctors
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"❌ Error listing hospital doctors for hospital_id {hospital_id}: {e}")
        raise DatabaseError("Failed to list hospital doctors", operation="select", table="users/hospital_user_roles", original_error=e)

