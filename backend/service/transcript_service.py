"""
Transcript Service - Role-based access control for consultation transcripts
Handles transcript retrieval with proper permissions for patients, doctors, and hospital admins
"""

import logging
from typing import List, Dict, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import joinedload
from fastapi import HTTPException

from models.models import (
    Consultation, ConsultationSessions, ConsultationMessages,
    Users, HospitalMaster
)
from database.redis import SessionManager

logger = logging.getLogger(__name__)


class TranscriptService:
    """Service for managing consultation transcripts with role-based access"""
    
    def __init__(self):
        self.session_manager = SessionManager()
    
    async def get_patient_transcripts(
        self, 
        db: AsyncSession, 
        patient_user_id: int,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get all transcripts for a patient
        Patient can see all their consultation transcripts
        """
        try:
            # Query consultations for this patient with ALL relationships eagerly loaded
            query = (
                select(Consultation)
                .where(Consultation.patient_id == patient_user_id)
                .order_by(Consultation.consultation_date.desc())
                .limit(limit)
                .options(
                    joinedload(Consultation.patient),  # Load patient relationship
                    joinedload(Consultation.doctor),   # Load doctor relationship
                    joinedload(Consultation.hospital), # Load hospital relationship
                    joinedload(Consultation.consultation_sessions)
                    .joinedload(ConsultationSessions.consultation_messages)
                )
            )
            
            result = await db.execute(query)
            consultations = result.unique().scalars().all()
            
            transcripts = []
            for consult in consultations:
                transcript_data = self._build_transcript_sync(consult)
                transcripts.append(transcript_data)
            
            logger.info(f"Retrieved {len(transcripts)} transcripts for patient {patient_user_id}")
            return transcripts
            
        except Exception as e:
            logger.error(f"Error fetching patient transcripts: {e}", exc_info=True)
            raise
    
    async def get_doctor_transcripts(
        self,
        db: AsyncSession,
        doctor_user_id: int,
        patient_id: Optional[int] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get all transcripts for a doctor
        Doctor can only see transcripts from consultations they conducted
        Optionally filter by specific patient
        """
        try:
            # Build query
            conditions = [Consultation.doctor_id == doctor_user_id]
            
            if patient_id:
                conditions.append(Consultation.patient_id == patient_id)
            
            query = (
                select(Consultation)
                .where(and_(*conditions))
                .order_by(Consultation.consultation_date.desc())
                .limit(limit)
                .options(
                    joinedload(Consultation.patient),  # Load patient relationship
                    joinedload(Consultation.doctor),   # Load doctor relationship
                    joinedload(Consultation.hospital), # Load hospital relationship
                    joinedload(Consultation.consultation_sessions)
                    .joinedload(ConsultationSessions.consultation_messages)
                )
            )
            
            result = await db.execute(query)
            consultations = result.unique().scalars().all()
            
            transcripts = []
            for consult in consultations:
                transcript_data = self._build_transcript_sync(consult)
                transcripts.append(transcript_data)
            
            logger.info(f"Retrieved {len(transcripts)} transcripts for doctor {doctor_user_id}")
            return transcripts
            
        except Exception as e:
            logger.error(f"Error fetching doctor transcripts: {e}", exc_info=True)
            raise
    
    async def get_hospital_admin_transcripts(
        self,
        db: AsyncSession,
        hospital_admin_user_id: int,
        doctor_id: Optional[int] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get all transcripts for a hospital admin
        Hospital admin can see all transcripts from doctors in their hospital
        Optionally filter by specific doctor
        """
        try:
            # First, get the hospital_id(s) this admin manages
            admin_query = (
                select(Users)
                .where(Users.user_id == hospital_admin_user_id)
                .options(joinedload(Users.hospital))
            )
            
            admin_result = await db.execute(admin_query)
            admin_user = admin_result.scalar_one_or_none()
            
            if not admin_user or not admin_user.hospital:
                logger.warning(f"Hospital admin {hospital_admin_user_id} has no associated hospitals")
                return []
            
            # Get hospital IDs this admin manages
            hospital_ids = [h.hospital_id for h in admin_user.hospital]
            
            # Build query conditions
            conditions = [Consultation.hospital_id.in_(hospital_ids)]
            
            if doctor_id:
                conditions.append(Consultation.doctor_id == doctor_id)
            
            query = (
                select(Consultation)
                .where(and_(*conditions))
                .order_by(Consultation.consultation_date.desc())
                .limit(limit)
                .options(
                    joinedload(Consultation.patient),  # Load patient relationship
                    joinedload(Consultation.doctor),   # Load doctor relationship
                    joinedload(Consultation.hospital), # Load hospital relationship
                    joinedload(Consultation.consultation_sessions)
                    .joinedload(ConsultationSessions.consultation_messages)
                )
            )
            
            result = await db.execute(query)
            consultations = result.unique().scalars().all()
            
            transcripts = []
            for consult in consultations:
                transcript_data = self._build_transcript_sync(consult)
                transcripts.append(transcript_data)
            
            logger.info(f"Retrieved {len(transcripts)} transcripts for hospital admin {hospital_admin_user_id} across {len(hospital_ids)} hospitals")
            return transcripts
            
        except Exception as e:
            logger.error(f"Error fetching hospital admin transcripts: {e}", exc_info=True)
            raise
    
    async def get_consultation_transcript(
        self,
        db: AsyncSession,
        consultation_id: int,
        user_id: int,
        user_role: str
    ) -> Dict[str, Any]:
        """
        Get a specific consultation transcript
        Verifies user has permission to view this transcript
        """
        try:
            # Fetch consultation with all relationships eagerly loaded
            query = (
                select(Consultation)
                .where(Consultation.consultation_id == consultation_id)
                .options(
                    joinedload(Consultation.patient),  # Load patient relationship
                    joinedload(Consultation.doctor),   # Load doctor relationship
                    joinedload(Consultation.hospital), # Load hospital relationship
                    joinedload(Consultation.consultation_sessions)
                    .joinedload(ConsultationSessions.consultation_messages)
                )
            )
            
            result = await db.execute(query)
            consultation = result.unique().scalar_one_or_none()
            
            if not consultation:
                raise HTTPException(status_code=404, detail="Consultation not found")
            
            # Check permissions
            has_access = await self._verify_transcript_access(
                consultation, user_id, user_role, db
            )
            
            if not has_access:
                raise HTTPException(
                    status_code=403, 
                    detail="You don't have permission to view this transcript"
                )
            
            # Build and return transcript (now synchronous since relationships are loaded)
            transcript = self._build_transcript_sync(consultation)
            logger.info(f"Retrieved transcript for consultation {consultation_id} by user {user_id} ({user_role})")
            return transcript
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching consultation transcript: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))
    
    async def _verify_transcript_access(
        self,
        consultation: Consultation,
        user_id: int,
        user_role: str,
        db: AsyncSession
    ) -> bool:
        """Verify if user has access to this consultation transcript"""
        user_role_lower = user_role.lower().strip()
        
        # Superadmin has access to everything
        if user_role_lower == "superadmin":
            return True
        
        # Patient can see their own transcripts
        if user_role_lower == "patient":
            return consultation.patient_id == user_id
        
        # Doctor can see transcripts they conducted
        if user_role_lower == "doctor":
            return consultation.doctor_id == user_id
        
        # Hospital admin can see transcripts from their hospital
        if user_role_lower == "hospital_admin":
            # Get admin's hospitals
            admin_query = (
                select(Users)
                .where(Users.user_id == user_id)
                .options(joinedload(Users.hospital))
            )
            result = await db.execute(admin_query)
            admin_user = result.scalar_one_or_none()
            
            if admin_user and admin_user.hospital:
                hospital_ids = [h.hospital_id for h in admin_user.hospital]
                return consultation.hospital_id in hospital_ids
        
        return False
    
    def _build_transcript_sync(
        self,
        consultation: Consultation
    ) -> Dict[str, Any]:
        """
        Build transcript data structure from consultation (synchronous)
        All relationships must be eagerly loaded before calling this method
        """
        try:
            # Get patient info
            patient_info = {
                "patient_id": consultation.patient_id,
                "patient_name": consultation.patient.username if consultation.patient else "Unknown",
                "patient_email": consultation.patient.email if consultation.patient else None
            }
            
            # Get doctor info
            doctor_info = {
                "doctor_id": consultation.doctor_id,
                "doctor_name": consultation.doctor.username if consultation.doctor else "Unknown",
                "doctor_email": consultation.doctor.email if consultation.doctor else None
            }
            
            # Get hospital info
            hospital_info = {
                "hospital_id": consultation.hospital_id,
                "hospital_name": consultation.hospital.hospital_name if consultation.hospital else None
            }
            
            # Build conversation messages from all sessions
            messages = []
            for session in consultation.consultation_sessions:
                # Also try to get messages from Redis if available
                redis_messages = []
                try:
                    redis_key = f"session-{session.session_id}"
                    redis_messages = self.session_manager.get_session_conversation(redis_key)
                except Exception as e:
                    logger.debug(f"Could not fetch Redis messages for session {session.session_id}: {e}")
                
                # Combine DB messages and Redis messages
                for msg in session.consultation_messages:
                    messages.append({
                        "message_id": msg.message_id,
                        "session_id": msg.session_id,
                        "sender_type": msg.sender_type,
                        "message_text": msg.message_text,
                        "timestamp": msg.timestamp.isoformat() if msg.timestamp else None
                    })
                
                # Add Redis messages if available
                for redis_msg in redis_messages:
                    if redis_msg.get('role') != 'system':  # Skip system messages
                        messages.append({
                            "sender_type": "patient" if redis_msg.get('role') == 'user' else "ai_doctor",
                            "message_text": redis_msg.get('content'),
                            "timestamp": None,  # Redis messages don't have timestamps
                            "source": "redis"
                        })
            
            # Sort messages by timestamp where available
            messages.sort(key=lambda x: x.get('timestamp') or '9999-12-31', reverse=False)
            
            return {
                "consultation_id": consultation.consultation_id,
                "consultation_date": consultation.consultation_date.isoformat() if consultation.consultation_date else None,
                "consultation_type": consultation.consultation_type,
                "status": consultation.status,
                "patient": patient_info,
                "doctor": doctor_info,
                "hospital": hospital_info,
                "total_sessions": len(consultation.consultation_sessions),
                "total_messages": len(messages),
                "messages": messages
            }
            
        except Exception as e:
            logger.error(f"Error building transcript: {e}", exc_info=True)
            raise


# Create singleton instance
transcript_service = TranscriptService()

