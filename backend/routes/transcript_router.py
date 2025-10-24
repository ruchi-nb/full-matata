"""
Transcript Router - Role-based endpoints for consultation transcripts
Provides secure access to transcripts based on user roles
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database.database import get_db
from dependencies.dependencies import require_permissions
from service.transcript_service import transcript_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/transcripts", tags=["Transcripts"])


@router.get("/patient")
async def get_patient_transcripts(
    limit: int = Query(50, description="Maximum number of transcripts to return"),
    caller: Dict[str, Any] = Depends(require_permissions(["patient.transcripts.view"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all transcripts for the current patient
    
    **Patient Access**: Can see all their own consultation transcripts
    """
    try:
        # Verify role
        global_role = caller.get("global_role") or {}
        role_name = (global_role.get("role_name") or "").strip().lower()
        
        if role_name not in ["patient", "superadmin"]:
            raise HTTPException(status_code=403, detail="Only patients can access this endpoint")
        
        user_id = caller.get("user_id")
        
        transcripts = await transcript_service.get_patient_transcripts(
            db=db,
            patient_user_id=user_id,
            limit=limit
        )
        
        return {
            "status": "success",
            "count": len(transcripts),
            "transcripts": transcripts
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching patient transcripts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/doctor")
async def get_doctor_transcripts(
    patient_id: Optional[int] = Query(None, description="Filter by specific patient"),
    limit: int = Query(50, description="Maximum number of transcripts to return"),
    caller: Dict[str, Any] = Depends(require_permissions(["doctor.transcripts.view"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all transcripts for the current doctor
    
    **Doctor Access**: Can only see transcripts from consultations they conducted
    - Optionally filter by specific patient_id
    """
    try:
        # Verify role
        global_role = caller.get("global_role") or {}
        role_name = (global_role.get("role_name") or "").strip().lower()
        
        if role_name not in ["doctor", "superadmin"]:
            raise HTTPException(status_code=403, detail="Only doctors can access this endpoint")
        
        user_id = caller.get("user_id")
        
        transcripts = await transcript_service.get_doctor_transcripts(
            db=db,
            doctor_user_id=user_id,
            patient_id=patient_id,
            limit=limit
        )
        
        return {
            "status": "success",
            "count": len(transcripts),
            "filter": {"patient_id": patient_id} if patient_id else None,
            "transcripts": transcripts
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching doctor transcripts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hospital-admin")
async def get_hospital_admin_transcripts(
    doctor_id: Optional[int] = Query(None, description="Filter by specific doctor"),
    limit: int = Query(100, description="Maximum number of transcripts to return"),
    caller: Dict[str, Any] = Depends(require_permissions(["hospital_admin.transcripts.view"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all transcripts for the current hospital admin
    
    **Hospital Admin Access**: Can see all transcripts from doctors in their hospital(s)
    - Optionally filter by specific doctor_id
    """
    try:
        # Verify role
        global_role = caller.get("global_role") or {}
        role_name = (global_role.get("role_name") or "").strip().lower()
        
        if role_name not in ["hospital_admin", "superadmin"]:
            raise HTTPException(status_code=403, detail="Only hospital admins can access this endpoint")
        
        user_id = caller.get("user_id")
        
        transcripts = await transcript_service.get_hospital_admin_transcripts(
            db=db,
            hospital_admin_user_id=user_id,
            doctor_id=doctor_id,
            limit=limit
        )
        
        return {
            "status": "success",
            "count": len(transcripts),
            "filter": {"doctor_id": doctor_id} if doctor_id else None,
            "transcripts": transcripts
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching hospital admin transcripts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/consultation/{consultation_id}")
async def get_specific_consultation_transcript(
    consultation_id: int,
    caller: Dict[str, Any] = Depends(require_permissions(["transcripts.view"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific consultation transcript by ID
    
    **Access Control**:
    - Patient: Can view their own consultations
    - Doctor: Can view consultations they conducted
    - Hospital Admin: Can view consultations from their hospital
    - Superadmin: Can view any consultation
    """
    try:
        user_id = caller.get("user_id")
        global_role = caller.get("global_role") or {}
        role_name = (global_role.get("role_name") or "").strip().lower()
        
        transcript = await transcript_service.get_consultation_transcript(
            db=db,
            consultation_id=consultation_id,
            user_id=user_id,
            user_role=role_name
        )
        
        return {
            "status": "success",
            "transcript": transcript
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching consultation transcript: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_transcript_summary(
    caller: Dict[str, Any] = Depends(require_permissions(["transcripts.view"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    """
    Get summary statistics for transcripts accessible to the current user
    """
    try:
        user_id = caller.get("user_id")
        global_role = caller.get("global_role") or {}
        role_name = (global_role.get("role_name") or "").strip().lower()
        
        if role_name == "patient":
            transcripts = await transcript_service.get_patient_transcripts(
                db=db, patient_user_id=user_id, limit=1000
            )
        elif role_name == "doctor":
            transcripts = await transcript_service.get_doctor_transcripts(
                db=db, doctor_user_id=user_id, limit=1000
            )
        elif role_name == "hospital_admin":
            transcripts = await transcript_service.get_hospital_admin_transcripts(
                db=db, hospital_admin_user_id=user_id, limit=1000
            )
        elif role_name == "superadmin":
            # For superadmin, return a simplified summary
            return {
                "status": "success",
                "message": "Superadmin has access to all transcripts across all hospitals"
            }
        else:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Calculate statistics
        total_transcripts = len(transcripts)
        total_messages = sum(t.get("total_messages", 0) for t in transcripts)
        total_sessions = sum(t.get("total_sessions", 0) for t in transcripts)
        
        return {
            "status": "success",
            "role": role_name,
            "summary": {
                "total_transcripts": total_transcripts,
                "total_messages": total_messages,
                "total_sessions": total_sessions,
                "avg_messages_per_transcript": round(total_messages / total_transcripts, 2) if total_transcripts > 0 else 0
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching transcript summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

