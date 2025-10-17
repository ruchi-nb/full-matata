#!/usr/bin/env python3
"""
TTS Warmup Script
Warms up Sarvam TTS connections for faster first requests
"""

import asyncio
import logging
from integrations.sarvam.tts_streaming import SarvamTTSService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def warmup_tts_connections():
    """Warmup TTS connections for faster streaming"""
    logger.info("🚀 Starting TTS connection warmup...")
    
    tts_service = SarvamTTSService()
    
    # Perform startup warmup
    await tts_service.startup_warmup()
    
    logger.info("✅ TTS warmup complete!")

if __name__ == "__main__":
    asyncio.run(warmup_tts_connections())
