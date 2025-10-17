from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from database.database import get_db
from dependencies.dependencies import require_permissions, require_doctor, get_current_user, ensure_specialties_exist
from schema.schema import (
    DoctorProfileRead, DoctorProfileUpdate,
    SpecialityOut,
    HospitalPatientOut, StatusOut
)
from service.doctors_service import (
    get_doctor_profile, update_doctor_profile,
    list_doctor_specialties, assign_doctor_specialties,
    list_patients_for_doctor, get_patient_details, list_patient_consultations_for_doctor,
    analytics_patients, consultations_monthly
)
from centralisedErrorHandling.ErrorHandling import DatabaseError, ValidationError, UserNotFoundError


router = APIRouter(prefix="/doctors", tags=["doctors" ])


@router.get("/profile", response_model=DoctorProfileRead)
async def read_profile(
    caller: Dict[str, Any] = Depends(require_permissions(["doctor.profile.view"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_id = caller.get("user_id")
        user, _ = await get_doctor_profile(db, user_id)
        return DoctorProfileRead(user_id=int(user.user_id), username=user.username, email=user.email)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="Doctor not found")
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to load profile") from de


@router.put("/profile", response_model=DoctorProfileRead)
async def put_profile(
    payload: DoctorProfileUpdate,
    caller: Dict[str, Any] = Depends(require_permissions(["doctor.profile.update"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_id = caller.get("user_id")
        user, _ = await update_doctor_profile(db, user_id, payload.model_dump(exclude_none=True))
        return DoctorProfileRead(user_id=int(user.user_id), username=user.username, email=user.email)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="Doctor not found")
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to update profile") from de


@router.get("/specialties", response_model=List[SpecialityOut])
async def get_specialties(
    caller: Dict[str, Any] = Depends(require_permissions(["doctor.profile.view"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    try:
        rows = await list_doctor_specialties(db, caller.get("user_id"))
        return [SpecialityOut(specialty_id=int(s.specialty_id), name=s.name, description=s.description, status=s.status) for s in rows]
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to fetch specialties") from de


@router.put("/specialties", response_model=List[SpecialityOut])
async def put_specialties(
    specialty_ids: List[int],
    caller: Dict[str, Any] = Depends(require_permissions(["doctor.profile.update"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    try:
        await ensure_specialties_exist(specialty_ids, db)
        rows = await assign_doctor_specialties(db, caller.get("user_id"), specialty_ids)
        return [SpecialityOut(specialty_id=int(s.specialty_id), name=s.name, description=s.description, status=s.status) for s in rows]
    except ValidationError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) from ve
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to assign specialties") from de


@router.get("/patients", response_model=List[HospitalPatientOut])
async def list_patients(
    caller: Dict[str, Any] = Depends(require_permissions(["doctor.patients.list"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    try:
        rows = await list_patients_for_doctor(db, caller.get("user_id"))
        out: List[HospitalPatientOut] = []
        for u in rows:
            out.append(HospitalPatientOut(user_id=int(u.user_id), username=u.username, email=u.email))
        return out
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to list patients") from de


@router.get("/patients/{id}")
async def get_patient(
    id: int,
    caller: Dict[str, Any] = Depends(require_permissions(["doctor.patient.view"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    try:
        user, details = await get_patient_details(db, id)
        return {
            "user": {"user_id": int(user.user_id), "username": user.username, "email": user.email},
            "details": details.model_dump() if details else None,
        }
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="Patient not found")
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to fetch patient") from de


@router.get("/patients/{id}/consultations")
async def get_patient_consultations(
    id: int,
    caller: Dict[str, Any] = Depends(require_permissions(["doctor.patient.consultations.list"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    try:
        rows = await list_patient_consultations_for_doctor(db, caller.get("user_id"), id)
        return {
            "consultations": [
                {
                    "consultation_id": int(c.consultation_id),
                    "patient_id": int(c.patient_id),
                    "doctor_id": int(c.doctor_id),
                    "hospital_id": int(c.hospital_id) if c.hospital_id is not None else None,
                    "specialty_id": int(c.specialty_id),
                    "consultation_date": c.consultation_date.isoformat() if c.consultation_date else None,
                    "status": c.status,
                    "total_duration": int(c.total_duration or 0),
                }
                for c in rows
            ]
        }
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to fetch consultations") from de


@router.get("/analytics/patients")
async def patients_analytics(
    caller: Dict[str, Any] = Depends(require_permissions(["doctor.analytics.patients"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await analytics_patients(db, caller.get("user_id"))
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to compute analytics") from de


@router.get("/consultations/monthly")
async def monthly_consultations(
    caller: Dict[str, Any] = Depends(require_permissions(["doctor.consultations.monthly"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    try:
        return {"series": await consultations_monthly(db, caller.get("user_id"))}
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to compute monthly breakdown") from de


