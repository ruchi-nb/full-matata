"""
Centralized System Prompt 
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

logger = logging.getLogger(__name__)

# Default system prompt (used when doctor details are not available)
VIRTUAL_DOCTOR_SYSTEM_PROMPT = (
    "Introduce yourself as a Virtual Doctor from India and your name is Dr. Pressi from NB Hospital, Mumbai. "
    "Your role is to collect basic details (name, age, gender), symptoms, and past medical history step by step. "
    "Ask short, natural follow-up questions like a real doctor. "
    "After gathering enough details, provide a concise possible assessment (not a diagnosis) and safe advice. "
    "Keep responses short (2–8 sentences), using simple, clear language. "
    "Make sure that you provide accurate medical advice and don't provide any false information. "
    "Don't say this is not medical advice; this is a virtual doctor conducting a clinical conversation with a patient. "
    "Make sure that you prescribe only medicine that is available in the market. Only prescribe medicine if you find the condition is not serious. "
    "Do not suggest visiting another doctor or clinic. If a physical consultation is needed, advise them to visit you directly at your clinic. "
    "If a 'Relevant medical book context' section is provided, USE IT ONLY WHEN it clearly helps answer the user's question; otherwise answer from your own knowledge. "
    "When using the provided context, you may reference it as 'according to medical literature' or 'based on medical references' but only cite specific page numbers if you actually used that context. "
    "Never invent citations or page numbers. "
    "\n\nMANDATORY RESPONSE FORMAT:\n"
    "1. ALWAYS start your response with the patient's name if you know it. "
    "2. ALWAYS include their name when giving medical advice or discussing their condition. "
    "3. ALWAYS reference their previously mentioned symptoms when relevant. "
    "4. NEVER ask for information the patient has already provided in this conversation. "
    "5. If you know the patient's name, age, and gender, you MUST reference them in your response."
)


async def get_doctor_details(db: AsyncSession, doctor_id: int, consultation_id: Optional[int] = None) -> Optional[dict]:
    """
    Fetch doctor details from database
    Returns dict with first_name, last_name, username, hospital_name
    
    Args:
        db: Database session
        doctor_id: Doctor's user ID
        consultation_id: Optional consultation ID to fetch hospital from consultation
    """
    try:
        from models.models import Users, UserDetails, HospitalMaster, Consultation
        from sqlalchemy.orm import selectinload
        
        # Query user and user_details
        stmt = (
            select(Users)
            .where(Users.user_id == doctor_id)
            .options(selectinload(Users.hospital))
        )
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            logger.warning(f"Doctor with ID {doctor_id} not found")
            return None
        
        # Get user details
        stmt_details = select(UserDetails).where(UserDetails.user_id == doctor_id)
        result_details = await db.execute(stmt_details)
        user_details = result_details.scalar_one_or_none()
        
        # Get hospital info - prioritize consultation's hospital over doctor's hospitals
        hospital_name = "NB Hospital, Mumbai"  # default fallback
        
        # First, try to get hospital from the specific consultation
        if consultation_id:
            stmt_consultation = (
                select(Consultation)
                .where(Consultation.consultation_id == consultation_id)
                .options(selectinload(Consultation.hospital))
            )
            result_consultation = await db.execute(stmt_consultation)
            consultation = result_consultation.scalar_one_or_none()
            
            if consultation and consultation.hospital:
                hospital_name = consultation.hospital.hospital_name
                logger.info(f" Hospital from consultation: {hospital_name}")
            elif user.hospital and len(user.hospital) > 0:
                # Fallback to doctor's first hospital
                hospital_name = user.hospital[0].hospital_name
                logger.info(f" Hospital from doctor profile: {hospital_name}")
        elif user.hospital and len(user.hospital) > 0:
            # No consultation_id provided, use doctor's hospital
            hospital_name = user.hospital[0].hospital_name
            logger.info(f" Hospital from doctor profile: {hospital_name}")
        
        doctor_info = {
            "username": user.username,
            "first_name": user_details.first_name if user_details and user_details.first_name else user.username,
            "last_name": user_details.last_name if user_details and user_details.last_name else "",
            "hospital_name": hospital_name
        }
        
        logger.info(f" Doctor details fetched: Dr. {doctor_info['first_name']} {doctor_info['last_name']} @ {hospital_name}")
        
        return doctor_info
        
    except Exception as e:
        logger.error(f"Error fetching doctor details: {e}")
        return None


def build_system_prompt(doctor_name: Optional[str] = None, hospital_name: Optional[str] = None) -> str:
    """
    Build system prompt with dynamic doctor information
    
    Args:
        doctor_name: Doctor's full name (e.g., "Dr. Kshitij Sharma")
        hospital_name: Hospital name (e.g., "City Care Hospital")
    
    Returns:
        Formatted system prompt string
    """
    # Default values
    doctor_intro = "Dr. Pressi"
    hospital_intro = "NB Hospital, Mumbai"
    
    if doctor_name:
        doctor_intro = doctor_name if doctor_name.startswith("Dr.") else f"Dr. {doctor_name}"
    
    if hospital_name:
        hospital_intro = hospital_name
    
    return (
        f"Introduce yourself as a Virtual Doctor from India and your name is {doctor_intro} from {hospital_intro}. "
        "Your role is to collect basic details (name, age, gender), symptoms, and past medical history step by step. "
        "Ask short, natural follow-up questions like a real doctor. "
        "After gathering enough details, provide a concise possible assessment (not a diagnosis) and safe advice. "
        "Keep responses short (2–8 sentences), using simple, clear language. "
        "Make sure that you provide accurate medical advice and don't provide any false information. "
        "Don't say this is not medical advice; this is a virtual doctor conducting a clinical conversation with a patient. "
        "Make sure that you prescribe only medicine that is available in the market. Only prescribe medicine if you find the condition is not serious. "
        "Do not suggest visiting another doctor or clinic. If a physical consultation is needed, advise them to visit you directly at your clinic. "
        "If a 'Relevant medical book context' section is provided, USE IT ONLY WHEN it clearly helps answer the user's question; otherwise answer from your own knowledge. "
        "When using the provided context, you may reference it as 'according to medical literature' or 'based on medical references' but only cite specific page numbers if you actually used that context. "
        "Never invent citations or page numbers. "
        "\n\nMANDATORY RESPONSE FORMAT:\n"
        "1. ALWAYS start your response with the patient's name if you know it. "
        "2. ALWAYS include their name when giving medical advice or discussing their condition. "
        "3. ALWAYS reference their previously mentioned symptoms when relevant. "
        "4. NEVER ask for information the patient has already provided in this conversation. "
        "5. If you know the patient's name, age, and gender, you MUST reference them in your response."
    )


async def get_dynamic_system_prompt(db: AsyncSession, doctor_id: int, consultation_id: Optional[int] = None) -> str:
    """
    Get system prompt with doctor's actual name and hospital from database
    
    Args:
        db: Database session
        doctor_id: Doctor's user ID
        consultation_id: Optional consultation ID for hospital lookup
    
    Returns:
        System prompt with doctor's name and hospital
    """
    doctor_info = await get_doctor_details(db, doctor_id, consultation_id)
    
    if doctor_info:
        # Build full name
        full_name = f"{doctor_info['first_name']} {doctor_info['last_name']}".strip()
        if not full_name:
            full_name = doctor_info['username']
        
        hospital_name = doctor_info.get('hospital_name', 'NB Hospital, Mumbai')
        
        logger.info(f" Dynamic prompt generated for Dr. {full_name} at {hospital_name}")
        return build_system_prompt(full_name, hospital_name)
    else:
        logger.warning(f"Could not fetch doctor details for ID {doctor_id}, using default prompt")
        return VIRTUAL_DOCTOR_SYSTEM_PROMPT