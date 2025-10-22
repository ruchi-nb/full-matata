from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
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
from models.models import Consultation, Users, UserDetails, Specialties
from centralisedErrorHandling.ErrorHandling import DatabaseError, ValidationError, UserNotFoundError


router = APIRouter(prefix="/doctors", tags=["doctors" ])


@router.get("/profile")
async def read_profile(
    caller: Dict[str, Any] = Depends(require_permissions(["doctor.profile.view"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    """
    Get doctor profile with complete user details
    """
    try:
        user_id = caller.get("user_id")
        user, details = await get_doctor_profile(db, user_id)
        
        return {
            "user_id": int(user.user_id),
            "username": user.username,
            "email": user.email,
            "first_name": details.first_name if details else None,
            "last_name": details.last_name if details else None,
            "phone": details.phone if details else None,
            "gender": details.gender if details else None,
            "address": details.address if details else None,
            "dob": details.dob.isoformat() if details and details.dob else None,
        }
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="Doctor not found")
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to load profile") from de


@router.put("/profile")
async def put_profile(
    payload: DoctorProfileUpdate,
    caller: Dict[str, Any] = Depends(require_permissions(["doctor.profile.update"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    """
    Update doctor profile with complete user details
    """
    try:
        user_id = caller.get("user_id")
        user, details = await update_doctor_profile(db, user_id, payload.model_dump(exclude_none=True))
        
        return {
            "user_id": int(user.user_id),
            "username": user.username,
            "email": user.email,
            "first_name": details.first_name if details else None,
            "last_name": details.last_name if details else None,
            "phone": details.phone if details else None,
            "gender": details.gender if details else None,
            "address": details.address if details else None,
            "dob": details.dob.isoformat() if details and details.dob else None,
        }
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


@router.get("/dashboard-stats")
async def get_doctor_dashboard_stats(
    caller: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get comprehensive dashboard statistics for doctor including:
    - Total consultations
    - Total patients
    - Patients list with consultation counts
    - Hospital-specific data (tenant isolation)
    """
    try:
        import logging
        
        logger = logging.getLogger(__name__)
        doctor_id = caller.get("user_id")
        hospital_id = caller.get("hospital_id")  # From JWT token
        
        logger.info(f"Fetching dashboard stats for doctor_id: {doctor_id}, hospital_id: {hospital_id}")
        
        # Get total consultations for this doctor
        total_consultations_query = select(func.count(Consultation.consultation_id)).where(
            Consultation.doctor_id == doctor_id
        )
        if hospital_id:
            total_consultations_query = total_consultations_query.where(Consultation.hospital_id == hospital_id)
        
        total_consultations = (await db.execute(total_consultations_query)).scalar() or 0
        
        # Get unique patients for this doctor
        patients_query = (
            select(Users, UserDetails, func.count(Consultation.consultation_id).label('consultation_count'))
            .join(Consultation, Consultation.patient_id == Users.user_id)
            .outerjoin(UserDetails, UserDetails.user_id == Users.user_id)
            .where(Consultation.doctor_id == doctor_id)
        )
        
        # Add hospital filter if doctor belongs to a hospital (tenant isolation)
        if hospital_id:
            patients_query = patients_query.where(Consultation.hospital_id == hospital_id)
        
        patients_query = patients_query.group_by(Users.user_id).order_by(
            func.max(Consultation.consultation_date).desc()
        )
        
        patients_result = await db.execute(patients_query)
        patients_data = patients_result.all()
        
        # Build patient list with details
        patients_list = []
        for user, user_details, consultation_count in patients_data:
            # Get latest consultation for this patient
            latest_consultation_query = (
                select(Consultation, Specialties)
                .outerjoin(Specialties, Specialties.specialty_id == Consultation.specialty_id)
                .where(
                    and_(
                        Consultation.doctor_id == doctor_id,
                        Consultation.patient_id == user.user_id
                    )
                )
            )
            if hospital_id:
                latest_consultation_query = latest_consultation_query.where(Consultation.hospital_id == hospital_id)
            
            latest_consultation_query = latest_consultation_query.order_by(Consultation.consultation_date.desc()).limit(1)
            latest_consultation_result = await db.execute(latest_consultation_query)
            latest_consultation_row = latest_consultation_result.first()
            
            specialty_name = None
            consultation_date = None
            consultation_time = None
            consultation_reason = None
            
            if latest_consultation_row:
                consultation, specialty = latest_consultation_row
                specialty_name = specialty.name if specialty else "General"
                if consultation.consultation_date:
                    consultation_date = consultation.consultation_date.strftime("%Y-%m-%d")
                    consultation_time = consultation.consultation_date.strftime("%I:%M %p")
                consultation_reason = consultation.reason if hasattr(consultation, 'reason') else "Follow-up"
            
            patients_list.append({
                "user_id": user.user_id,
                "username": user.username,
                "email": user.email,
                "first_name": user_details.first_name if user_details else None,
                "last_name": user_details.last_name if user_details else None,
                "phone": user_details.phone if user_details else None,
                "specialty": specialty_name or "General",
                "consultation_count": int(consultation_count),
                "last_consultation_date": consultation_date,
                "last_consultation_time": consultation_time,
                "reason": consultation_reason or "Consultation"
            })
        
        total_patients = len(patients_list)
        
        logger.info(f"Dashboard stats: {total_consultations} consultations, {total_patients} patients")
        
        return {
            "doctor_id": doctor_id,
            "hospital_id": hospital_id,
            "stats": {
                "total_consultations": int(total_consultations),
                "total_patients": int(total_patients),
            },
            "patients": patients_list
        }
        
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching doctor dashboard stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard statistics: {str(e)}")


