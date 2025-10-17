# Enhanced Health Check and Services Status Endpoints
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database.database import get_db, AsyncSessionLocal
from database.redis import _redis_client
from integrations.unified_services import sarvam_service, deepgram_service, openai_service
from dependencies.dependencies import get_current_user
import asyncio
import time
import logging
from typing import Dict, Any, Optional
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# ========================================
# PHASE 1.1: ENHANCED HEALTH CHECK ENDPOINT
# ========================================

async def check_database_connectivity() -> Dict[str, Any]:
    """Check database connectivity and performance"""
    try:
        start_time = time.time()
        async with AsyncSessionLocal() as session:
            # Test basic connectivity
            result = await session.execute(text("SELECT 1"))
            result.scalar()
            
            # Test more complex query
            result = await session.execute(text("SELECT COUNT(*) FROM users LIMIT 1"))
            user_count = result.scalar()
            
            response_time = (time.time() - start_time) * 1000
            
            return {
                "status": "healthy",
                "response_time_ms": round(response_time, 2),
                "user_count": user_count,
                "connection_pool": {
                    "pool_size": AsyncSessionLocal.bind.pool.size(),
                    "checked_in": AsyncSessionLocal.bind.pool.checkedin(),
                    "checked_out": AsyncSessionLocal.bind.pool.checkedout(),
                    "overflow": AsyncSessionLocal.bind.pool.overflow()
                }
            }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "response_time_ms": None
        }

async def check_redis_connectivity() -> Dict[str, Any]:
    """Check Redis connectivity and performance"""
    try:
        start_time = time.time()
        
        if _redis_client is None:
            return {
                "status": "unavailable",
                "error": "Redis client not initialized",
                "response_time_ms": None
            }
        
        # Test basic connectivity
        await _redis_client.ping()
        
        # Test set/get operations
        test_key = f"health_check:{int(time.time())}"
        await _redis_client.set(test_key, "test_value", ex=10)
        test_value = await _redis_client.get(test_key)
        await _redis_client.delete(test_key)
        
        response_time = (time.time() - start_time) * 1000
        
        # Get Redis info
        info = await _redis_client.info()
        
        return {
            "status": "healthy",
            "response_time_ms": round(response_time, 2),
            "test_value": test_value,
            "redis_info": {
                "version": info.get("redis_version"),
                "uptime_seconds": info.get("uptime_in_seconds"),
                "connected_clients": info.get("connected_clients"),
                "used_memory_human": info.get("used_memory_human"),
                "keyspace_hits": info.get("keyspace_hits"),
                "keyspace_misses": info.get("keyspace_misses")
            }
        }
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "response_time_ms": None
        }

async def check_external_services() -> Dict[str, Any]:
    """Check external service connectivity and API key validation"""
    services_status = {}
    
    # Check OpenAI
    try:
        start_time = time.time()
        # Test with a simple completion request
        test_response = await openai_service.chat_service.create_completion_async(
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=5,
            timeout=5.0
        )
        response_time = (time.time() - start_time) * 1000
        
        services_status["openai"] = {
            "status": "healthy",
            "response_time_ms": round(response_time, 2),
            "api_key_valid": bool(test_response),
            "model_available": True
        }
    except Exception as e:
        logger.error(f"OpenAI health check failed: {e}")
        services_status["openai"] = {
            "status": "unhealthy",
            "error": str(e),
            "api_key_valid": False,
            "response_time_ms": None
        }
    
    # Check Sarvam
    try:
        start_time = time.time()
        # Test with a simple translation
        test_response = await sarvam_service.translation_service.text_translate_async(
            "Hello", "en", "hi", timeout=5.0
        )
        response_time = (time.time() - start_time) * 1000
        
        services_status["sarvam"] = {
            "status": "healthy",
            "response_time_ms": round(response_time, 2),
            "api_key_valid": bool(test_response),
            "translation_available": True
        }
    except Exception as e:
        logger.error(f"Sarvam health check failed: {e}")
        services_status["sarvam"] = {
            "status": "unhealthy",
            "error": str(e),
            "api_key_valid": False,
            "response_time_ms": None
        }
    
    # Check Deepgram
    try:
        start_time = time.time()
        # Test with a simple audio file (silence)
        import io
        silence_audio = io.BytesIO(b'\x00' * 1000)  # 1KB of silence
        test_response = await deepgram_service.stt_service.transcribe_audio_async(
            silence_audio, "en-US", timeout=5.0
        )
        response_time = (time.time() - start_time) * 1000
        
        services_status["deepgram"] = {
            "status": "healthy",
            "response_time_ms": round(response_time, 2),
            "api_key_valid": bool(test_response),
            "stt_available": True
        }
    except Exception as e:
        logger.error(f"Deepgram health check failed: {e}")
        services_status["deepgram"] = {
            "status": "unhealthy",
            "error": str(e),
            "api_key_valid": False,
            "response_time_ms": None
        }
    
    return services_status

@router.get("/health")
async def health_check():
    """
    Enhanced health check endpoint with comprehensive service monitoring
    """
    start_time = time.time()
    
    # Run all health checks concurrently
    db_task = asyncio.create_task(check_database_connectivity())
    redis_task = asyncio.create_task(check_redis_connectivity())
    services_task = asyncio.create_task(check_external_services())
    
    # Wait for all checks to complete
    db_status, redis_status, services_status = await asyncio.gather(
        db_task, redis_task, services_task, return_exceptions=True
    )
    
    total_response_time = (time.time() - start_time) * 1000
    
    # Determine overall health status
    overall_status = "healthy"
    if (db_status.get("status") != "healthy" or 
        redis_status.get("status") != "healthy" or
        any(service.get("status") != "healthy" for service in services_status.values())):
        overall_status = "degraded"
    
    return JSONResponse(content={
        "status": overall_status,
        "timestamp": time.time(),
        "response_time_ms": round(total_response_time, 2),
        "version": "1.0.0",
        "services": {
            "database": db_status,
            "redis": redis_status,
            "external_services": services_status
        },
        "environment": {
            "debug_mode": getattr(settings, "DEBUG", False),
            "cors_origins": getattr(settings, "CORS_ORIGINS", []),
            "database_url_configured": bool(getattr(settings, "DATABASE_URL", None)),
            "redis_url_configured": bool(getattr(settings, "REDIS_URL", None))
        }
    })

@router.get("/services/status")
async def services_status():
    """
    Detailed services status endpoint for monitoring and debugging
    """
    start_time = time.time()
    
    # Get detailed service information
    db_status = await check_database_connectivity()
    redis_status = await check_redis_connectivity()
    services_status = await check_external_services()
    
    # Get additional system information
    import psutil
    import os
    
    system_info = {
        "cpu_percent": psutil.cpu_percent(interval=1),
        "memory": {
            "total": psutil.virtual_memory().total,
            "available": psutil.virtual_memory().available,
            "percent": psutil.virtual_memory().percent
        },
        "disk": {
            "total": psutil.disk_usage('/').total,
            "free": psutil.disk_usage('/').free,
            "percent": psutil.disk_usage('/').percent
        },
        "process": {
            "pid": os.getpid(),
            "memory_usage": psutil.Process().memory_info().rss,
            "cpu_percent": psutil.Process().cpu_percent()
        }
    }
    
    # Get API key status
    api_keys_status = {
        "openai": bool(getattr(settings, "OPENAI_API_KEY", None)),
        "sarvam": bool(getattr(settings, "SARVAM_API_KEY", None)),
        "deepgram": bool(getattr(settings, "DEEPGRAM_API_KEY", None))
    }
    
    total_response_time = (time.time() - start_time) * 1000
    
    return JSONResponse(content={
        "timestamp": time.time(),
        "response_time_ms": round(total_response_time, 2),
        "overall_status": "healthy" if all(
            service.get("status") == "healthy" 
            for service in [db_status, redis_status] + list(services_status.values())
        ) else "degraded",
        "database": db_status,
        "redis": redis_status,
        "external_services": services_status,
        "api_keys": api_keys_status,
        "system_info": system_info,
        "configuration": {
            "database_url_configured": bool(getattr(settings, "DATABASE_URL", None)),
            "redis_url_configured": bool(getattr(settings, "REDIS_URL", None)),
            "debug_mode": getattr(settings, "DEBUG", False),
            "cors_origins": getattr(settings, "CORS_ORIGINS", []),
            "trusted_ips_enforced": getattr(settings, "ENFORCE_TRUSTED_IPS", False)
        }
    })

# ========================================
# PHASE 1.1: MISSING CONSULTATION ENDPOINTS
# ========================================

@router.get("/consultation/{consultation_id}")
async def get_consultation_details(
    consultation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get consultation details by ID"""
    try:
        from service.consultation_service import get_consultation_by_id
        
        consultation = await get_consultation_by_id(db, consultation_id, current_user["user_id"])
        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")
        
        return JSONResponse(content={
            "consultation_id": consultation.id,
            "patient_id": consultation.patient_id,
            "doctor_id": consultation.doctor_id,
            "specialty_id": consultation.specialty_id,
            "hospital_id": consultation.hospital_id,
            "consultation_type": consultation.consultation_type,
            "status": consultation.status,
            "created_at": consultation.created_at.isoformat(),
            "updated_at": consultation.updated_at.isoformat(),
            "duration_minutes": consultation.duration_minutes,
            "audio_provider": consultation.audio_provider,
            "language": consultation.language
        })
    except Exception as e:
        logger.error(f"Error getting consultation {consultation_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/consultation/{consultation_id}/transcript")
async def get_consultation_transcript(
    consultation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get consultation transcript"""
    try:
        from service.consultation_service import get_consultation_transcript
        
        transcript = await get_consultation_transcript(db, consultation_id, current_user["user_id"])
        if not transcript:
            raise HTTPException(status_code=404, detail="Transcript not found")
        
        return JSONResponse(content={
            "consultation_id": consultation_id,
            "transcript": transcript,
            "message_count": len(transcript.get("messages", [])),
            "total_duration": transcript.get("total_duration", 0)
        })
    except Exception as e:
        logger.error(f"Error getting transcript for consultation {consultation_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/consultation/{consultation_id}/end")
async def end_consultation(
    consultation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """End consultation and calculate duration"""
    try:
        from service.consultation_service import end_consultation_by_id
        
        result = await end_consultation_by_id(db, consultation_id, current_user["user_id"])
        if not result:
            raise HTTPException(status_code=404, detail="Consultation not found")
        
        return JSONResponse(content={
            "consultation_id": consultation_id,
            "status": "ended",
            "duration_minutes": result.get("duration_minutes", 0),
            "ended_at": result.get("ended_at"),
            "message": "Consultation ended successfully"
        })
    except Exception as e:
        logger.error(f"Error ending consultation {consultation_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/consultation/patient/{patient_id}")
async def get_patient_consultations(
    patient_id: int,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get patient consultations with pagination"""
    try:
        from service.consultation_service import get_patient_consultations
        
        # Verify patient access
        if current_user["user_id"] != patient_id and current_user.get("role") not in ["doctor", "hospital_admin", "superadmin"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        consultations = await get_patient_consultations(db, patient_id, limit, offset)
        
        return JSONResponse(content={
            "patient_id": patient_id,
            "consultations": consultations,
            "total_count": len(consultations),
            "limit": limit,
            "offset": offset
        })
    except Exception as e:
        logger.error(f"Error getting consultations for patient {patient_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ========================================
# PHASE 1.1: PUBLIC DOCTOR SEARCH
# ========================================

@router.get("/doctors")
async def get_all_doctors(
    specialty: Optional[str] = None,
    city: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Public doctor search endpoint - no authentication required"""
    try:
        from sqlalchemy import select, and_, or_
        from models.models import Users, UserDetails, HospitalUserRole, HospitalRoleMaster, HospitalMaster
        
        # Build query to get doctors with their details
        query = select(
            Users.user_id,
            Users.username,
            Users.email,
            Users.is_active,
            UserDetails.first_name,
            UserDetails.last_name,
            UserDetails.phone,
            UserDetails.dob,
            UserDetails.gender,
            UserDetails.address,
            UserDetails.avatar_url,
            UserDetails.languages,
            HospitalRoleMaster.role_name.label('specialty'),
            HospitalMaster.hospital_name.label('hospital_name'),
            HospitalMaster.city.label('city')
        ).select_from(
            Users
            .join(UserDetails, Users.user_id == UserDetails.user_id)
            .join(HospitalUserRole, Users.user_id == HospitalUserRole.user_id)
            .join(HospitalRoleMaster, HospitalUserRole.hospital_role_id == HospitalRoleMaster.role_id)
            .join(HospitalMaster, HospitalUserRole.hospital_id == HospitalMaster.hospital_id)
        ).where(
            and_(
                Users.is_active == True,
                HospitalRoleMaster.role_name.in_(['doctor', 'specialist', 'cardiologist', 'neurologist', 'pediatrician', 'dermatologist', 'orthopedic', 'gynecologist', 'psychiatrist', 'oncologist'])
            )
        )
        
        # Add filters
        if specialty:
            query = query.where(HospitalRoleMaster.role_name.ilike(f"%{specialty}%"))
        if city:
            query = query.where(HospitalMaster.city.ilike(f"%{city}%"))
            
        # Add pagination
        query = query.offset(offset).limit(limit)
        
        result = await db.execute(query)
        doctors = result.fetchall()
        
        # Transform to frontend format
        doctor_list = []
        for doctor in doctors:
            doctor_list.append({
                "id": doctor.user_id,
                "name": f"{doctor.first_name or ''} {doctor.last_name or ''}".strip() or doctor.username,
                "email": doctor.email,
                "phone": doctor.phone,
                "specialty": doctor.specialty,
                "hospital_name": doctor.hospital_name,
                "city": doctor.city,
                "languages": doctor.languages or "English",
                "avatar_url": doctor.avatar_url,
                "is_active": doctor.is_active,
                "experience": "Experienced",  # Default for now
                "location": f"{doctor.city}, {doctor.hospital_name}" if doctor.city and doctor.hospital_name else "Online Consultation"
            })
        
        return JSONResponse(content={
            "doctors": doctor_list,
            "total_count": len(doctor_list),
            "limit": limit,
            "offset": offset,
            "filters": {
                "specialty": specialty,
                "city": city
            }
        })
        
    except Exception as e:
        logger.error(f"Error fetching doctors: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/doctors/{doctor_id}")
async def get_doctor_by_id(
    doctor_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get specific doctor details - no authentication required"""
    try:
        from sqlalchemy import select, and_
        from models.models import Users, UserDetails, HospitalUserRole, HospitalRoleMaster, HospitalMaster
        
        query = select(
            Users.user_id,
            Users.username,
            Users.email,
            Users.is_active,
            UserDetails.first_name,
            UserDetails.last_name,
            UserDetails.phone,
            UserDetails.dob,
            UserDetails.gender,
            UserDetails.address,
            UserDetails.avatar_url,
            UserDetails.languages,
            HospitalRoleMaster.role_name.label('specialty'),
            HospitalMaster.hospital_name.label('hospital_name'),
            HospitalMaster.city.label('city')
        ).select_from(
            Users
            .join(UserDetails, Users.user_id == UserDetails.user_id)
            .join(HospitalUserRole, Users.user_id == HospitalUserRole.user_id)
            .join(HospitalRoleMaster, HospitalUserRole.hospital_role_id == HospitalRoleMaster.role_id)
            .join(HospitalMaster, HospitalUserRole.hospital_id == HospitalMaster.hospital_id)
        ).where(
            and_(
                Users.user_id == doctor_id,
                Users.is_active == True
            )
        )
        
        result = await db.execute(query)
        doctor = result.fetchone()
        
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")
        
        return JSONResponse(content={
            "id": doctor.user_id,
            "name": f"{doctor.first_name or ''} {doctor.last_name or ''}".strip() or doctor.username,
            "email": doctor.email,
            "phone": doctor.phone,
            "specialty": doctor.specialty,
            "hospital_name": doctor.hospital_name,
            "city": doctor.city,
            "languages": doctor.languages or "English",
            "avatar_url": doctor.avatar_url,
            "is_active": doctor.is_active,
            "experience": "Experienced",
            "location": f"{doctor.city}, {doctor.hospital_name}" if doctor.city and doctor.hospital_name else "Online Consultation"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching doctor {doctor_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/doctors/{doctor_id}/languages")
async def get_doctor_languages(
    doctor_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get doctor's supported languages - no authentication required"""
    try:
        from sqlalchemy import select, and_
        from models.models import Users, UserDetails
        
        query = select(UserDetails.languages).select_from(
            Users.join(UserDetails, Users.user_id == UserDetails.user_id)
        ).where(
            and_(
                Users.user_id == doctor_id,
                Users.is_active == True
            )
        )
        
        result = await db.execute(query)
        languages_row = result.fetchone()
        
        if not languages_row or not languages_row.languages:
            return JSONResponse(content={"languages": ["en"]})
        
        # Parse languages string and convert to language codes
        language_map = {
            'English': 'en', 'Hindi': 'hi', 'Bengali': 'bn', 'Gujarati': 'gu',
            'Kannada': 'kn', 'Malayalam': 'ml', 'Marathi': 'mr', 'Punjabi': 'pa',
            'Tamil': 'ta', 'Telugu': 'te',
        }
        
        languages = languages_row.languages.split(',')
        language_codes = []
        for lang in languages:
            lang = lang.strip()
            if lang in language_map:
                language_codes.append(language_map[lang])
            else:
                language_codes.append('en')  # Default to English
        
        # Remove duplicates and ensure at least English is available
        language_codes = list(set(language_codes))
        if 'en' not in language_codes:
            language_codes.append('en')
        
        return JSONResponse(content={"languages": language_codes})
        
    except Exception as e:
        logger.error(f"Error fetching doctor languages {doctor_id}: {e}")
        return JSONResponse(content={"languages": ["en"]})

# ========================================
# PHASE 1.1: PUBLIC HOSPITAL SEARCH
# ========================================

@router.get("/search/hospitals")
async def search_hospitals(
    query: Optional[str] = None,
    specialty: Optional[str] = None,
    city: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Public hospital search endpoint - no authentication required"""
    try:
        from service.hospitals_service import search_hospitals_public
        
        hospitals = await search_hospitals_public(
            db, 
            query=query, 
            specialty=specialty, 
            city=city, 
            limit=limit, 
            offset=offset
        )
        
        return JSONResponse(content={
            "hospitals": hospitals,
            "total_count": len(hospitals),
            "limit": limit,
            "offset": offset,
            "search_params": {
                "query": query,
                "specialty": specialty,
                "city": city
            }
        })
    except Exception as e:
        logger.error(f"Error searching hospitals: {e}")
        raise HTTPException(status_code=500, detail=str(e))
