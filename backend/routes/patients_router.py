from fastapi import (
    APIRouter, 
    Depends, 
    HTTPException,
    status)
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database.database import get_db
from dependencies.dependencies import require_permissions
from schema.schema import (
    RegisterPatientIn, RegisterPatientOut,
    UserDetailsRead, UserDetailsUpdate
)
from service.patients_service import (
    create_patient, 
    get_patient_profile, 
    update_patient_profile, 
    list_patient_consultations
)
from models.models import PatientHospitals, HospitalSpecialties, Specialties, DoctorSpecialties, Users
from centralisedErrorHandling.ErrorHandling import ValidationError, DatabaseError, UserNotFoundError
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/auth/register/patient", response_model=RegisterPatientOut, status_code=status.HTTP_201_CREATED)
async def register_patient(
    payload: RegisterPatientIn,
    db: AsyncSession = Depends(get_db),
):
    try:
        new_user = await create_patient(db=db, payload=payload)
        return RegisterPatientOut(
            user_id=int(new_user.user_id),
            username=new_user.username,
            email=new_user.email,
            next="/login"
        )
    except ValidationError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) from ve
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail=f"Database error: {str(de)}") from de
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create patient: {str(e)}") from e


@router.get("/patients/profile", response_model=UserDetailsRead)
async def get_profile(
    caller: Dict[str, Any] = Depends(require_permissions(["patient.profile.view"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    # enforce patient role
    global_role = caller.get("global_role") or {}
    role_name = (global_role.get("role_name") or "").strip().lower()
    if role_name != "patient":
        raise HTTPException(status_code=403, detail="Only patients may access their profile")

    user_id = caller.get("user_id")
    try:
        details = await get_patient_profile(db=db, user_id=user_id)
        if not details:
            raise HTTPException(status_code=404, detail="Profile not found")
        return details
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to fetch profile") from de


@router.put("/patients/profile", response_model=UserDetailsRead)
async def put_profile(
    payload: UserDetailsUpdate,
    caller: Dict[str, Any] = Depends(require_permissions(["patient.profile.update"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    global_role = caller.get("global_role") or {}
    role_name = (global_role.get("role_name") or "").strip().lower()
    if role_name != "patient":
        raise HTTPException(status_code=403, detail="Only patients may update their profile")

    user_id = caller.get("user_id")
    try:
        updated = await update_patient_profile(db=db, user_id=user_id, update_data=payload.model_dump(exclude_none=True))
        return updated
    except UserNotFoundError as unfe:
        raise HTTPException(status_code=404, detail=str(unfe)) from unfe
    except ValidationError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) from ve
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to update profile") from de

@router.get("/patients/consultations")
async def get_consultations(
    caller: Dict[str, Any] = Depends(require_permissions(["patient.consultation.list"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    global_role = caller.get("global_role") or {}
    role_name = (global_role.get("role_name") or "").strip().lower()
    if role_name != "patient":
        raise HTTPException(status_code=403, detail="Only patients may list their consultations")

    user_id = caller.get("user_id")
    try:
        consultations = await list_patient_consultations(db=db, user_id=user_id, limit=200)
        return {"consultations": consultations}
    except DatabaseError as de:
        raise HTTPException(status_code=500, detail="Failed to fetch consultations") from de


@router.get("/patients/specialties")
async def get_patient_hospital_specialties(
    caller: Dict[str, Any] = Depends(require_permissions(["patient.profile.view"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db),
):
    """
    Get specialties available in the patient's hospital.
    Patient can only see specialties from hospitals they are associated with.
    
    Logic:
    1. Get user_id from JWT token
    2. Find patient's hospital(s) from patient_hospitals table (using user_id)
    3. Get specialties for those hospitals from hospital_specialties table
    """
    global_role = caller.get("global_role") or {}
    role_name = (global_role.get("role_name") or "").strip().lower()
    if role_name != "patient":
        raise HTTPException(status_code=403, detail="Only patients may access hospital specialties")

    user_id = caller.get("user_id")
    
    try:
        logger.info(f"🔍 Fetching specialties for patient user_id={user_id}")
        
        # Get patient's hospital(s) from patient_hospitals table
        # PatientHospitals uses 'user_id' not 'patient_id' 
        # Patient role: hospital_role_id=3 (tenant), role_id=4 (global)
        patient_hospitals_query = select(PatientHospitals).where(
            PatientHospitals.user_id == int(user_id),
            PatientHospitals.is_active == 1
        )
        patient_hospitals_result = await db.execute(patient_hospitals_query)
        patient_hospitals = patient_hospitals_result.scalars().all()
        
        logger.info(f"📋 Query result: Found {len(patient_hospitals)} patient_hospitals entries")
        
        if not patient_hospitals:
            logger.warning(f"⚠️ Patient user_id={user_id} is NOT in patient_hospitals table!")
            logger.warning(f"⚠️ This means the patient was created BEFORE the fix or not by hospital admin")
            # Return empty list if patient has no hospital
            return {"specialties": [], "message": "No hospital assigned to patient"}
        
        # Get all hospital IDs for this patient
        hospital_ids = [ph.hospital_id for ph in patient_hospitals]
        logger.info(f"🏥 Patient user_id={user_id} is associated with hospitals: {hospital_ids}")
        
        # Get specialties for these hospitals from hospital_specialties table
        specialties_query = (
            select(Specialties)
            .join(HospitalSpecialties, HospitalSpecialties.specialty_id == Specialties.specialty_id)
            .where(
                HospitalSpecialties.hospital_id.in_(hospital_ids),
                Specialties.status == 'active'
            )
            .distinct()
            .order_by(Specialties.name)
        )
        
        specialties_result = await db.execute(specialties_query)
        specialties = specialties_result.scalars().all()
        
        logger.info(f"✅ Found {len(specialties)} specialties for patient user_id={user_id}")
        if len(specialties) == 0:
            logger.warning(f"⚠️ 0 specialties found! Check hospital_specialties table for hospital_ids: {hospital_ids}")
        
        # Format response
        specialties_list = [
            {
                "specialty_id": int(s.specialty_id),
                "name": s.name,
                "description": s.description,
                "status": s.status
            }
            for s in specialties
        ]
        
        return {"specialties": specialties_list}
        
    except Exception as e:
        logger.error(f"Error fetching specialties for patient user_id={user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch specialties") from e


@router.get("/patients/my-doctors")
async def get_patient_consulted_doctors(
    caller: Dict[str, Any] = Depends(require_permissions(["patient.profile.view"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    """
    Get list of doctors that the patient has consulted with (based on past consultations).
    Only returns doctors with whom the patient has had at least one consultation.
    
    Logic:
    1. Get user_id (patient_id) from JWT token
    2. Query consultations table to find all unique doctor_ids for this patient
    3. Get doctor details and their specialties
    4. Return list of doctors with consultation count
    """
    global_role = caller.get("global_role") or {}
    role_name = (global_role.get("role_name") or "").strip().lower()
    if role_name != "patient":
        raise HTTPException(status_code=403, detail="Only patients may access their consulted doctors")

    user_id = caller.get("user_id")
    
    try:
        logger.info(f"🔍 Fetching consulted doctors for patient user_id={user_id}")
        
        from models.models import Consultation, UserDetails
        from sqlalchemy import func, distinct
        
        # Query to get doctors the patient has consulted with and consultation count
        consulted_doctors_query = (
            select(
                Users,
                UserDetails,
                func.count(Consultation.consultation_id).label('consultation_count'),
                func.max(Consultation.consultation_date).label('last_consultation_date')
            )
            .join(Consultation, Consultation.doctor_id == Users.user_id)
            .outerjoin(UserDetails, UserDetails.user_id == Users.user_id)
            .where(Consultation.patient_id == int(user_id))
            .group_by(Users.user_id)
            .order_by(func.max(Consultation.consultation_date).desc())
        )
        
        result = await db.execute(consulted_doctors_query)
        doctors_data = result.all()
        
        logger.info(f"✅ Found {len(doctors_data)} consulted doctors for patient user_id={user_id}")
        
        # Format response with doctor specialties
        doctors_list = []
        for user, user_details, consultation_count, last_consultation_date in doctors_data:
            # Get doctor's specialties
            specialties_query = (
                select(Specialties)
                .join(DoctorSpecialties, DoctorSpecialties.specialty_id == Specialties.specialty_id)
                .where(DoctorSpecialties.user_id == user.user_id)
            )
            specialties_result = await db.execute(specialties_query)
            doctor_specialties = specialties_result.scalars().all()
            
            doctor_dict = {
                "user_id": int(user.user_id),
                "username": user.username,
                "email": user.email,
                "first_name": user_details.first_name if user_details else None,
                "last_name": user_details.last_name if user_details else None,
                "phone": user_details.phone if user_details else None,
                "gender": user_details.gender if user_details else None,
                "consultation_count": consultation_count,
                "last_consultation_date": last_consultation_date.isoformat() if last_consultation_date else None,
                "specialties": [
                    {
                        "specialty_id": int(s.specialty_id),
                        "name": s.name,
                        "description": s.description
                    }
                    for s in doctor_specialties
                ],
                # Add primary specialty (first one) for convenience
                "specialty": doctor_specialties[0].name if doctor_specialties else None
            }
            doctors_list.append(doctor_dict)
        
        return {"doctors": doctors_list, "count": len(doctors_list)}
        
    except Exception as e:
        logger.error(f"Error fetching consulted doctors for patient user_id={user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch consulted doctors") from e


@router.get("/patients/doctors")
async def get_patient_hospital_doctors(
    specialty_id: Optional[int] = None,
    caller: Dict[str, Any] = Depends(require_permissions(["patient.profile.view"], allow_super_admin=False)),
    db: AsyncSession = Depends(get_db),
):
    """
    Get doctors available in the patient's hospital, optionally filtered by specialty.
    Patient can only see doctors from hospitals they are associated with.
    
    Logic:
    1. Get user_id from JWT token
    2. Find patient's hospital(s) from patient_hospitals table (using user_id)
    3. Get doctors for those hospitals from doctor_hospitals table
    4. Optionally filter by specialty_id
    5. Return doctor details with their specialties
    """
    global_role = caller.get("global_role") or {}
    role_name = (global_role.get("role_name") or "").strip().lower()
    if role_name != "patient":
        raise HTTPException(status_code=403, detail="Only patients may access hospital doctors")

    user_id = caller.get("user_id")
    
    try:
        logger.info(f"🔍 Fetching doctors for patient user_id={user_id}, specialty_id={specialty_id}")
        
        # Get patient's hospital(s) from patient_hospitals table
        patient_hospitals_query = select(PatientHospitals).where(
            PatientHospitals.user_id == int(user_id),
            PatientHospitals.is_active == 1
        )
        patient_hospitals_result = await db.execute(patient_hospitals_query)
        patient_hospitals = patient_hospitals_result.scalars().all()
        
        logger.info(f"📋 Query result: Found {len(patient_hospitals)} patient_hospitals entries")
        
        if not patient_hospitals:
            logger.warning(f"⚠️ Patient user_id={user_id} is NOT in patient_hospitals table!")
            return {"doctors": [], "message": "No hospital assigned to patient"}
        
        # Get all hospital IDs for this patient
        hospital_ids = [ph.hospital_id for ph in patient_hospitals]
        logger.info(f"🏥 Patient user_id={user_id} is associated with hospitals: {hospital_ids}")
        
        # Build query to get doctors from these hospitals
        from models.models import t_doctor_hospitals, UserDetails
        
        # Base query: get doctors from patient's hospitals
        doctors_query = (
            select(Users, UserDetails)
            .join(t_doctor_hospitals, t_doctor_hospitals.c.user_id == Users.user_id)
            .outerjoin(UserDetails, UserDetails.user_id == Users.user_id)
            .where(t_doctor_hospitals.c.hospital_id.in_(hospital_ids))
        )
        
        # If specialty_id is provided, filter by it
        if specialty_id:
            doctors_query = doctors_query.join(
                DoctorSpecialties, 
                DoctorSpecialties.user_id == Users.user_id
            ).where(DoctorSpecialties.specialty_id == specialty_id)
        
        doctors_result = await db.execute(doctors_query)
        doctors_data = doctors_result.all()
        
        logger.info(f"✅ Found {len(doctors_data)} doctors for patient user_id={user_id}")
        
        # Format response with doctor specialties
        doctors_list = []
        for user, user_details in doctors_data:
            # Get doctor's specialties
            specialties_query = (
                select(Specialties)
                .join(DoctorSpecialties, DoctorSpecialties.specialty_id == Specialties.specialty_id)
                .where(DoctorSpecialties.user_id == user.user_id)
            )
            specialties_result = await db.execute(specialties_query)
            doctor_specialties = specialties_result.scalars().all()
            
            doctor_dict = {
                "user_id": int(user.user_id),
                "username": user.username,
                "email": user.email,
                "first_name": user_details.first_name if user_details else None,
                "last_name": user_details.last_name if user_details else None,
                "phone": user_details.phone if user_details else None,
                "gender": user_details.gender if user_details else None,
                "specialties": [
                    {
                        "specialty_id": int(s.specialty_id),
                        "name": s.name,
                        "description": s.description
                    }
                    for s in doctor_specialties
                ],
                # Add primary specialty (first one) for convenience
                "specialty": doctor_specialties[0].name if doctor_specialties else None
            }
            doctors_list.append(doctor_dict)
        
        return {"doctors": doctors_list}
        
    except Exception as e:
        logger.error(f"Error fetching doctors for patient user_id={user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch doctors") from e