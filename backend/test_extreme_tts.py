#!/usr/bin/env python3
"""
Test script for EXTREME Sarvam TTS streaming optimizations
Tests the performance improvements with extreme timeout settings
"""

import asyncio
import time
import logging
from integrations.sarvam.tts_streaming import SarvamTTSService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_extreme_tts_performance():
    """Test TTS performance with extreme optimizations"""
    
    # Initialize the EXTREME optimized TTS service
    tts_service = SarvamTTSService()
    
    # Test text
    test_text = "Hello, this is a test of the EXTREME optimized Sarvam TTS streaming service."
    
    logger.info("🚀 Starting EXTREME TTS performance test...")
    
    # Test 1: First request (cold start)
    logger.info("📊 Test 1: First request (cold start)")
    start_time = time.time()
    
    chunk_count = 0
    first_chunk_time = None
    
    async for chunk in tts_service.text_to_speech_streaming_chunks(
        text=test_text,
        language="en-IN",
        speaker="karun"
    ):
        if first_chunk_time is None:
            first_chunk_time = time.time()
            ttfc = int((first_chunk_time - start_time) * 1000)
            logger.info(f"⚡ FIRST CHUNK received in {ttfc}ms")
        
        chunk_count += 1
        logger.debug(f"Chunk {chunk_count}: {len(chunk)} bytes")
    
    total_time = int((time.time() - start_time) * 1000)
    logger.info(f"✅ Test 1 complete: {chunk_count} chunks in {total_time}ms")
    
    # Test 2: Warmup connection
    logger.info("📊 Test 2: Warming up connection")
    warmup_start = time.time()
    await tts_service.warmup_connection("en-IN", "karun")
    warmup_time = int((time.time() - warmup_start) * 1000)
    logger.info(f"✅ Warmup complete in {warmup_time}ms")
    
    # Test 3: Second request (should be faster after warmup)
    logger.info("📊 Test 3: Second request (after warmup)")
    start_time = time.time()
    
    chunk_count = 0
    first_chunk_time = None
    
    async for chunk in tts_service.text_to_speech_streaming_chunks(
        text=test_text,
        language="en-IN", 
        speaker="karun"
    ):
        if first_chunk_time is None:
            first_chunk_time = time.time()
            ttfc = int((first_chunk_time - start_time) * 1000)
            logger.info(f"⚡ FIRST CHUNK received in {ttfc}ms")
        
        chunk_count += 1
        logger.debug(f"Chunk {chunk_count}: {len(chunk)} bytes")
    
    total_time = int((time.time() - start_time) * 1000)
    logger.info(f"✅ Test 3 complete: {chunk_count} chunks in {total_time}ms")
    
    logger.info("🎉 EXTREME TTS performance tests completed!")

if __name__ == "__main__":
    asyncio.run(test_extreme_tts_performance())
