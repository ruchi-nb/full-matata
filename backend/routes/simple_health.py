"""
Simple Health Check Routes
Lightweight health monitoring for services
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging
import time
from integrations.unified_services import sarvam_service, deepgram_service, openai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])

@router.get("/")
async def health_check() -> Dict[str, Any]:
    """Simple health check"""
    return {
        "status": "ok",
        "timestamp": time.time(),
        "services": {
            "sarvam": "available",
            "deepgram": "available", 
            "openai": "available"
        }
    }

@router.get("/services")
async def services_health() -> Dict[str, Any]:
    """Services health check"""
    try:
        return {
            "status": "ok",
            "timestamp": time.time(),
            "services": {
                "sarvam": {
                    "stt": "available",
                    "tts": "available",
                    "translation": "available"
                },
                "deepgram": {
                    "stt": "available",
                    "tts": "available"
                },
                "openai": {
                    "chat": "available"
                }
            }
        }
    except Exception as e:
        logger.error(f"Services health check failed: {e}")
        raise HTTPException(status_code=503, detail="Services health check failed")

