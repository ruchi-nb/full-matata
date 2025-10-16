"""
Sarvam TTS Streaming Service - Production Grade
Handles text-to-speech streaming functionality with ultra-low latency for real-time responses
"""

import logging
import time
import asyncio
import base64
import tempfile
from typing import Optional, AsyncGenerator
from sarvamai import AsyncSarvamAI
from config import settings
from typing import cast

logger = logging.getLogger(__name__)


class SarvamTTSService:
    """Production-grade Sarvam TTS service with optimized streaming"""
    
    def __init__(self):
        self.api_key = settings.SARVAM_API_KEY
        
        # Connection pool for reused WebSocket connections
        self._active_connections = {}
        self._connection_lock = asyncio.Lock()
        
        # Performance tuning - Optimized for complete audio streaming
        self._config_timeout = 2.0  # Reduced configuration timeout
        self._convert_timeout = 2.0  # Reduced text conversion timeout
        self._flush_timeout = 1.5  # Reduced flush timeout
        self._chunk_timeout = 0.08  # 80ms per chunk (ultra-low latency)
        self._stream_timeout = 60.0  # Extended overall stream timeout for complete audio
        self._inactivity_threshold = 10  # 10 × 80ms = 800ms inactivity detection (more conservative)
        
        # Audio buffering for immediate first chunk delivery
        self._min_chunk_size = 256  # Very small for immediate first chunk
        self._max_buffer_time = 0.05  # Max 50ms buffer time before yielding (immediate)
        self._audio_buffer = bytearray()
        self._first_chunk_sent = False  # Track if first chunk was sent

    def _convert_lang_code(self, lang_code: str) -> str:
        """Convert simple language codes to Sarvam format"""
        lang_map = {
            "hi": "hi-IN",
            "bn": "bn-IN",
            "ta": "ta-IN",
            "te": "te-IN",
            "mr": "mr-IN",
            "gu": "gu-IN",
            "kn": "kn-IN",
            "ml": "ml-IN",
            "pa": "pa-IN",
            "or": "od-IN",
            "en": "en-IN"
        }
        return lang_map.get(lang_code, lang_code)

    async def get_tts_audio_content(self, text: str, language: str = "hi-IN", speaker: str = None) -> Optional[bytes]:
        """Convert text to speech using Sarvam TTS streaming API"""
        try:
            speaker = speaker or settings.SARVAM_TTS_SPEAKER
            return await self.text_to_speech_streaming(text, language, speaker)
        except Exception as e:
            logger.error(f"TTS streaming error: {e}")
            return None

    async def text_to_speech_streaming(self, text: str, language: str = "hi-IN", speaker: str = None, 
                                      request_id: str = None, session_id: str = None) -> Optional[bytes]:
        """
        Convert text to speech using Sarvam TTS streaming API for full audio generation.
        Production-grade with optimized timeouts and error handling.
        """
        start_time = time.time()
        request_id = request_id or f"sarvam-tts-{int(time.time()*1000)}"
        
        try:
            speaker = speaker or settings.SARVAM_TTS_SPEAKER
            language_code = self._convert_lang_code(language.split("-")[0])
            logger.info(f"🎤 [Sarvam TTS] Batch: text_len={len(text)}, lang={language_code}, speaker={speaker}")
            
            client = AsyncSarvamAI(api_subscription_key=self.api_key)
            async with client.text_to_speech_streaming.connect(model=settings.SARVAM_TTS_MODEL) as ws:
                
                # Configure TTS parameters with timeout
                try:
                    await asyncio.wait_for(
                        ws.configure(target_language_code=language_code, speaker=speaker),
                        timeout=self._config_timeout
                    )
                except asyncio.TimeoutError:
                    logger.error("❌ Sarvam TTS configuration timeout")
                    return None
                
                # Send text for conversion
                safe_text = (text or "").strip()
                if not safe_text:
                    logger.warning("⚠️ Sarvam TTS: Empty text input")
                    return None
                
                try:
                    await asyncio.wait_for(ws.convert(safe_text), timeout=self._convert_timeout)
                    await asyncio.wait_for(ws.flush(), timeout=self._flush_timeout)
                except asyncio.TimeoutError:
                    logger.error("❌ Sarvam TTS conversion/flush timeout")
                    return None
                
                # Collect audio chunks with optimized timeout
                audio_chunks = []
                timeout_task = asyncio.create_task(asyncio.sleep(self._stream_timeout))
                message_task = None
                consecutive_timeouts = 0
                first_chunk_time = None
                
                try:
                    while not timeout_task.done():
                        try:
                            if message_task is None:
                                message_task = asyncio.create_task(ws.recv())
                            
                            done, pending = await asyncio.wait(
                                [message_task, timeout_task],
                                return_when=asyncio.FIRST_COMPLETED,
                                timeout=0.2  # 200ms timeout for batch mode
                            )
                            
                            if timeout_task in done:
                                break
                                
                            if message_task in done:
                                message = message_task.result()
                                message_task = None
                                consecutive_timeouts = 0
                                
                                # Track first chunk latency
                                if first_chunk_time is None:
                                    first_chunk_time = time.time()
                                    ttfc = int((first_chunk_time - start_time) * 1000)
                                    logger.info(f"⚡ Sarvam TTS TTFC: {ttfc}ms")
                                
                                from sarvamai import AudioOutput
                                if isinstance(message, AudioOutput):
                                    audio_b64 = cast(str, message.data.audio)
                                    missing = (-len(audio_b64)) % 4
                                    if missing:
                                        audio_b64 += "=" * missing
                                    audio_chunk = base64.b64decode(audio_b64)
                                    audio_chunks.append(audio_chunk)
                                else:
                                    if len(audio_chunks) > 0:
                                        break
                                    
                        except asyncio.TimeoutError:
                            consecutive_timeouts += 1
                            # 5 × 200ms = 1000ms (1s) inactivity detection
                            if consecutive_timeouts >= 5 and len(audio_chunks) > 0:
                                logger.info(f"✅ Sarvam TTS: Stream complete after {consecutive_timeouts * 0.2}s inactivity")
                                break
                            continue
                            
                finally:
                    if timeout_task and not timeout_task.done():
                        timeout_task.cancel()
                    if message_task and not message_task.done():
                        message_task.cancel()
                
                # Combine and return audio
                if audio_chunks:
                    combined_audio = b''.join(audio_chunks)
                    latency_ms = int((time.time() - start_time) * 1000)
                    logger.info(f"✅ Sarvam TTS Batch: {len(audio_chunks)} chunks, {len(combined_audio)} bytes, {latency_ms}ms")
                    return combined_audio
                else:
                    logger.warning("⚠️ Sarvam TTS: No audio data received")
                    return None
                    
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error(f"❌ Sarvam TTS Batch Error: {e} (after {latency_ms}ms)", exc_info=True)
            return None

    async def text_to_speech_streaming_chunks(
        self, 
        text: str, 
        language: str = "hi-IN", 
        speaker: str = None,
        request_id: str = None
    ) -> AsyncGenerator[bytes, None]:
        """
        Stream TTS audio chunks as they arrive (generator) - PRODUCTION GRADE.
        
        Optimizations:
        - Ultra-low latency chunk delivery (150ms timeout)
        - Fast inactivity detection (600ms = 4 × 150ms)
        - Robust error handling with retries
        - First chunk latency tracking
        - Graceful degradation
        
        Args:
            text: Text to convert to speech
            language: Language code (e.g., 'hi-IN')
            speaker: Speaker voice
            request_id: Optional request ID for tracking
        
        Yields:
            Audio chunks as bytes (PCM16 format)
        """
        start_time = time.time()
        request_id = request_id or f"sarvam-tts-stream-{int(time.time()*1000)}"
        
        try:
            speaker = speaker or settings.SARVAM_TTS_SPEAKER
            language_code = self._convert_lang_code(language.split("-")[0])
            
            logger.info(f"🎤 [Sarvam TTS Stream] text_len={len(text)}, lang={language_code}, speaker={speaker}, req_id={request_id}")
            
            # Reset first chunk flag for this streaming session
            self._first_chunk_sent = False
            
            # Validate input
            safe_text = (text or "").strip()
            if not safe_text:
                logger.warning("⚠️ Sarvam TTS Stream: Empty text input")
                return
            
            client = AsyncSarvamAI(api_subscription_key=self.api_key)
            
            # Retry logic for connection
            max_retries = 2
            retry_count = 0
            
            while retry_count <= max_retries:
                try:
                    async with client.text_to_speech_streaming.connect(model=settings.SARVAM_TTS_MODEL) as ws:
                        logger.info(f"✅ Sarvam TTS: WebSocket connected (attempt {retry_count + 1})")
                        
                        # Configure TTS parameters with timeout
                        try:
                            await asyncio.wait_for(
                                ws.configure(target_language_code=language_code, speaker=speaker),
                                timeout=self._config_timeout
                            )
                        except asyncio.TimeoutError:
                            logger.error("❌ Sarvam TTS: Configuration timeout")
                            if retry_count < max_retries:
                                retry_count += 1
                                await asyncio.sleep(0.5 * retry_count)
                                continue
                            return
                        
                        # Send text for conversion with timeout
                        try:
                            await asyncio.wait_for(ws.convert(safe_text), timeout=self._convert_timeout)
                        except asyncio.TimeoutError:
                            logger.error("❌ Sarvam TTS: Text conversion timeout")
                            if retry_count < max_retries:
                                retry_count += 1
                                await asyncio.sleep(0.5 * retry_count)
                                continue
                            return
                        
                        # Flush to ensure processing
                        try:
                            await asyncio.wait_for(ws.flush(), timeout=self._flush_timeout)
                        except asyncio.TimeoutError:
                            logger.warning("⚠️ Sarvam TTS: Flush timeout - continuing anyway")
                        
                        # Stream audio chunks with optimized buffering for smooth playback
                        message_task = None
                        chunk_count = 0
                        last_chunk_time = time.time()
                        consecutive_timeouts = 0
                        first_chunk_time = None
                        buffer_start_time = None
                        stream_start_time = time.time()
                        
                        try:
                            while True:
                                try:
                                    if message_task is None:
                                        message_task = asyncio.create_task(ws.recv())
                                    
                                    done, pending = await asyncio.wait(
                                        [message_task],
                                        return_when=asyncio.FIRST_COMPLETED,
                                        timeout=self._chunk_timeout  # 80ms - ultra-low latency
                                    )
                                    
                                    # Check for inactivity timeout
                                    current_time = time.time()
                                    time_since_last_chunk = current_time - last_chunk_time
                                    total_stream_time = current_time - stream_start_time
                                    
                                    # Only end if we've had no activity for a long time AND we've received some chunks
                                    if time_since_last_chunk > 5.0 and chunk_count > 0:
                                        # Check if we have any buffered audio before ending
                                        if self._audio_buffer:
                                            chunk_count += 1
                                            audio_to_yield = bytes(self._audio_buffer)
                                            logger.debug(f"🎵 Sarvam TTS: Final timeout chunk {chunk_count}: {len(audio_to_yield)} bytes")
                                            yield audio_to_yield
                                            self._audio_buffer.clear()
                                        
                                        logger.info(f"⏱️ Sarvam TTS: Stream complete after {time_since_last_chunk:.1f}s inactivity ({chunk_count} chunks total)")
                                        break
                                    elif time_since_last_chunk > 2.0:
                                        logger.debug(f"⏱️ Sarvam TTS: {time_since_last_chunk:.1f}s since last chunk, {chunk_count} chunks so far")
                                    elif time_since_last_chunk > 10.0 and chunk_count == 0:
                                        # If no chunks received for 10 seconds, abort
                                        logger.warning(f"⚠️ Sarvam TTS: No chunks received for {time_since_last_chunk:.1f}s - aborting")
                                        break
                                    elif total_stream_time > 120.0:
                                        # Hard timeout after 2 minutes
                                        logger.warning(f"⚠️ Sarvam TTS: Hard timeout after {total_stream_time:.1f}s - aborting")
                                        break
                                        
                                    if message_task in done:
                                        message = message_task.result()
                                        message_task = None
                                        last_chunk_time = time.time()
                                        consecutive_timeouts = 0
                                        
                                        # Track first chunk latency
                                        if first_chunk_time is None:
                                            first_chunk_time = time.time()
                                            ttfc = int((first_chunk_time - start_time) * 1000)
                                            logger.info(f"⚡ Sarvam TTS TTFC: {ttfc}ms")
                                        
                                        from sarvamai import AudioOutput
                                        if isinstance(message, AudioOutput):
                                            audio_b64 = cast(str, message.data.audio)
                                            missing = (-len(audio_b64)) % 4
                                            if missing:
                                                audio_b64 += "=" * missing
                                            audio_chunk = base64.b64decode(audio_b64)
                                            
                                            # Immediate first chunk delivery for ultra-low latency
                                            self._audio_buffer.extend(audio_chunk)
                                            
                                            # Initialize buffer timing
                                            if buffer_start_time is None:
                                                buffer_start_time = time.time()
                                            
                                            # Yield immediately for first chunk, then use buffering
                                            current_time = time.time()
                                            buffer_duration = current_time - buffer_start_time
                                            
                                            should_yield = False
                                            
                                            # Always yield first chunk immediately (no buffering)
                                            if not self._first_chunk_sent and len(self._audio_buffer) > 0:
                                                should_yield = True
                                                self._first_chunk_sent = True
                                                logger.info(f"🚀 Sarvam TTS: IMMEDIATE first chunk: {len(self._audio_buffer)} bytes")
                                            
                                            # For subsequent chunks, use buffering
                                            elif (len(self._audio_buffer) >= self._min_chunk_size or 
                                                  buffer_duration >= self._max_buffer_time):
                                                should_yield = True
                                            
                                            if should_yield and self._audio_buffer:
                                                chunk_count += 1
                                                audio_to_yield = bytes(self._audio_buffer)
                                                logger.debug(f"🎵 Sarvam TTS: Chunk {chunk_count}: {len(audio_to_yield)} bytes")
                                                yield audio_to_yield
                                                self._audio_buffer.clear()
                                                buffer_start_time = None
                                        else:
                                            logger.info(f"📨 Sarvam TTS: Non-audio message: {type(message)} - {message}")
                                            # Flush any remaining buffer before ending
                                            if self._audio_buffer:
                                                chunk_count += 1
                                                audio_to_yield = bytes(self._audio_buffer)
                                                logger.debug(f"🎵 Sarvam TTS: Final buffered chunk {chunk_count}: {len(audio_to_yield)} bytes")
                                                yield audio_to_yield
                                                self._audio_buffer.clear()
                                            
                                            if chunk_count > 0:
                                                logger.info("✅ Sarvam TTS: Stream complete (non-audio message)")
                                                break
                                            else:
                                                logger.warning("⚠️ Sarvam TTS: No audio chunks received before non-audio message")
                                        
                                except asyncio.TimeoutError:
                                    consecutive_timeouts += 1
                                    
                                    # Flush any buffered audio on timeout to prevent gaps
                                    if self._audio_buffer:
                                        chunk_count += 1
                                        audio_to_yield = bytes(self._audio_buffer)
                                        logger.debug(f"🎵 Sarvam TTS: Timeout flush chunk {chunk_count}: {len(audio_to_yield)} bytes")
                                        yield audio_to_yield
                                        self._audio_buffer.clear()
                                        buffer_start_time = None
                                    
                                    # Check inactivity timeout (handled above in the main loop)
                                    continue
                                    
                                except Exception as e:
                                    logger.warning(f"⚠️ Sarvam TTS: Message error: {e}")
                                    if chunk_count > 0:
                                        logger.info("✅ Sarvam TTS: Stream likely complete (error after chunks)")
                                        break
                                    else:
                                        break
                            
                        finally:
                            # Clean up tasks
                            if message_task and not message_task.done():
                                message_task.cancel()
                        
                        # Final flush of any remaining buffered audio
                        if self._audio_buffer:
                            chunk_count += 1
                            audio_to_yield = bytes(self._audio_buffer)
                            logger.debug(f"🎵 Sarvam TTS: Final flush chunk {chunk_count}: {len(audio_to_yield)} bytes")
                            yield audio_to_yield
                            self._audio_buffer.clear()
                        
                        # Log completion metrics
                        total_time = int((time.time() - start_time) * 1000)
                        logger.info(f"✅ Sarvam TTS Stream Complete: {chunk_count} chunks, {total_time}ms total")
                        break  # Success, exit retry loop
                        
                except (ConnectionError, asyncio.TimeoutError) as e:
                    if retry_count < max_retries:
                        retry_count += 1
                        logger.warning(f"🔄 Sarvam TTS: Retrying after error: {e} (attempt {retry_count + 1}/{max_retries + 1})")
                        await asyncio.sleep(0.5 * retry_count)
                        continue
                    else:
                        logger.error(f"❌ Sarvam TTS: Failed after {max_retries} retries: {e}")
                        raise
                        
        except Exception as e:
            elapsed = int((time.time() - start_time) * 1000)
            logger.error(f"❌ Sarvam TTS Stream Error: {e} (after {elapsed}ms)", exc_info=True)

    async def text_to_speech(self, text: str, language: str = "hi-IN", speaker: str = None) -> Optional[str]:
        """Convert text to speech using streaming API and return temp file path"""
        try:
            speaker = speaker or settings.SARVAM_TTS_SPEAKER
            audio_bytes = await self.text_to_speech_streaming(text, language, speaker)
            if not audio_bytes:
                return None
                
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_file.write(audio_bytes)
                return temp_file.name
                
        except Exception as e:
            logger.error(f"TTS file generation error: {e}")
            return None
