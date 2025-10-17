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
        
        # ULTRA-EXTREME Performance tuning for instant streaming
        self._config_timeout = 0.1  # Ultra-extreme configuration timeout
        self._convert_timeout = 0.05  # Ultra-extreme text conversion timeout
        self._flush_timeout = 0.02  # Ultra-extreme flush timeout
        self._chunk_timeout = 0.01  # 10ms per chunk (ultra-extreme low latency)
        self._stream_timeout = 60.0  # Extended overall stream timeout for complete audio
        self._inactivity_threshold = 3  # 3 × 10ms = 30ms inactivity detection
        
        # INSTANT first chunk delivery - zero buffering delays
        self._min_chunk_size = 32  # Extreme small for instant first chunk
        self._max_buffer_time = 0.005  # Max 5ms buffer time (instant)
        self._audio_buffer = bytearray()
        self._first_chunk_sent = False  # Track if first chunk was sent
        
        # Connection optimization settings
        self._connection_optimized = False

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

    async def warmup_connection(self, language_code: str = "hi-IN", speaker: str = None):
        """Warmup a connection to reduce first request latency"""
        try:
            speaker = speaker or settings.SARVAM_TTS_SPEAKER
            logger.info(f"Warming up TTS connection for {language_code}_{speaker}")
            
            client = AsyncSarvamAI(api_subscription_key=self.api_key)
            async with client.text_to_speech_streaming.connect(model=settings.SARVAM_TTS_MODEL) as ws:
                # Just configure and close - this warms up the connection
                await asyncio.wait_for(
                    ws.configure(target_language_code=language_code, speaker=speaker),
                    timeout=self._config_timeout
                )
                logger.info(f"TTS connection warmed up for {language_code}_{speaker}")
                return True
        except Exception as e:
            logger.warning(f"TTS warmup failed: {e}")
            return False

    async def startup_warmup(self):
        """Perform startup warmup for common configurations"""
        logger.info("Starting TTS startup warmup...")
        
        # Warmup common configurations in parallel
        warmup_tasks = [
            self.warmup_connection("en-IN", "karun"),
            self.warmup_connection("hi-IN", "karun"),
        ]
        
        try:
            results = await asyncio.gather(*warmup_tasks, return_exceptions=True)
            successful = sum(1 for r in results if r is True)
            logger.info(f"TTS startup warmup complete: {successful}/{len(warmup_tasks)} successful")
        except Exception as e:
            logger.warning(f"TTS startup warmup error: {e}")


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
            logger.info(f"Sarvam TTS Batch: text_len={len(text)}, lang={language_code}, speaker={speaker}")
            
            client = AsyncSarvamAI(api_subscription_key=self.api_key)
            async with client.text_to_speech_streaming.connect(model=settings.SARVAM_TTS_MODEL) as ws:
                
                # Configure TTS parameters with timeout
                try:
                    await asyncio.wait_for(
                        ws.configure(target_language_code=language_code, speaker=speaker),
                        timeout=self._config_timeout
                    )
                except asyncio.TimeoutError:
                    logger.error("Sarvam TTS configuration timeout")
                    return None
                
                # Send text for conversion
                safe_text = (text or "").strip()
                if not safe_text:
                    logger.warning("Sarvam TTS: Empty text input")
                    return None
                
                try:
                    await asyncio.wait_for(ws.convert(safe_text), timeout=self._convert_timeout)
                    await asyncio.wait_for(ws.flush(), timeout=self._flush_timeout)
                except asyncio.TimeoutError:
                    logger.error("Sarvam TTS conversion/flush timeout")
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
                                    logger.info(f"Sarvam TTS TTFC: {ttfc}ms")
                                
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
                                logger.info(f"Sarvam TTS: Stream complete after {consecutive_timeouts * 0.2}s inactivity")
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
                    logger.info(f"Sarvam TTS Batch: {len(audio_chunks)} chunks, {len(combined_audio)} bytes, {latency_ms}ms")
                    return combined_audio
                else:
                    logger.warning("Sarvam TTS: No audio data received")
                    return None
                    
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Sarvam TTS Batch Error: {e} (after {latency_ms}ms)", exc_info=True)
            return None

    async def text_to_speech_streaming_chunks(
        self, 
        text: str, 
        language: str = "hi-IN", 
        speaker: str = None,
        request_id: str = None
    ) -> AsyncGenerator[bytes, None]:
        """
        Stream TTS audio chunks as they arrive (generator) - ULTRA-OPTIMIZED.
        
        Optimizations:
        - Prewarmed connections for instant starts
        - Ultra-low latency chunk delivery (50ms timeout)
        - Fast inactivity detection (400ms = 8 × 50ms)
        - Immediate first chunk delivery
        - Connection pooling and reuse
        
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
            
            logger.info(f"Sarvam TTS Stream: text_len={len(text)}, lang={language_code}, speaker={speaker}, req_id={request_id}")
            
            # Reset first chunk flag for this streaming session
            self._first_chunk_sent = False
            
            # Validate input
            safe_text = (text or "").strip()
            if not safe_text:
                logger.warning("Sarvam TTS Stream: Empty text input")
                return
            
            # Create optimized connection
            client = AsyncSarvamAI(api_subscription_key=self.api_key)
            
            async with client.text_to_speech_streaming.connect(model=settings.SARVAM_TTS_MODEL) as ws:
                logger.info(f"Sarvam TTS: Connected with ULTRA-EXTREME optimization")
                
                # Start listening for chunks IMMEDIATELY - even before configuration
                message_task = asyncio.create_task(ws.recv())
                chunk_count = 0
                first_chunk_time = None
                stream_start_time = time.time()
                
                # Configure, convert, and flush in parallel with chunk listening
                config_task = asyncio.create_task(
                    asyncio.wait_for(
                        ws.configure(target_language_code=language_code, speaker=speaker),
                        timeout=self._config_timeout
                    )
                )
                
                try:
                    # Wait for configuration to complete
                    await config_task
                    logger.debug("Configuration complete")
                    
                    # Send text for conversion
                    convert_task = asyncio.create_task(
                        asyncio.wait_for(ws.convert(safe_text), timeout=self._convert_timeout)
                    )
                    await convert_task
                    logger.debug("Conversion complete")
                    
                    # Flush to start processing
                    flush_task = asyncio.create_task(
                        asyncio.wait_for(ws.flush(), timeout=self._flush_timeout)
                    )
                    await flush_task
                    logger.debug("Flush complete - streaming started")
                    
                except asyncio.TimeoutError as e:
                    logger.warning(f"Sarvam TTS: Setup timeout - continuing anyway: {e}")
                except Exception as e:
                    logger.warning(f"Sarvam TTS: Setup error - continuing anyway: {e}")
                
                # EXTREME-OPTIMIZED audio chunk streaming for instant delivery
                last_chunk_time = time.time()
                consecutive_timeouts = 0
                
                try:
                    while True:
                        try:
                            # Use the already started message task or create new one
                            if message_task.done():
                                message = message_task.result()
                                # Create new task for next message
                                message_task = asyncio.create_task(ws.recv())
                            else:
                                # Wait for current task with extreme timeout
                                done, pending = await asyncio.wait(
                                    [message_task],
                                    return_when=asyncio.FIRST_COMPLETED,
                                    timeout=self._chunk_timeout  # 20ms - extreme low latency
                                )
                                
                                if message_task in done:
                                    message = message_task.result()
                                    # Create new task for next message
                                    message_task = asyncio.create_task(ws.recv())
                                else:
                                    # Timeout - check for inactivity
                                    current_time = time.time()
                                    time_since_last_chunk = current_time - last_chunk_time
                                    total_stream_time = current_time - stream_start_time
                                    
                                    # Extreme-fast inactivity detection
                                    if time_since_last_chunk > 1.0 and chunk_count > 0:
                                        # Flush any remaining buffer before ending
                                        if self._audio_buffer:
                                            chunk_count += 1
                                            audio_to_yield = bytes(self._audio_buffer)
                                            logger.debug(f"Sarvam TTS: Final timeout chunk {chunk_count}: {len(audio_to_yield)} bytes")
                                            yield audio_to_yield
                                            self._audio_buffer.clear()
                                        
                                        logger.info(f"Sarvam TTS: Stream complete after {time_since_last_chunk:.1f}s inactivity ({chunk_count} chunks total)")
                                        break
                                    elif time_since_last_chunk > 5.0 and chunk_count == 0:
                                        # If no chunks received for 5 seconds, abort
                                        logger.warning(f"Sarvam TTS: No chunks received for {time_since_last_chunk:.1f}s - aborting")
                                        break
                                    elif total_stream_time > 120.0:
                                        # Hard timeout after 2 minutes
                                        logger.warning(f"Sarvam TTS: Hard timeout after {total_stream_time:.1f}s - aborting")
                                        break
                                    
                                    continue
                            
                            # Process the message
                            last_chunk_time = time.time()
                            consecutive_timeouts = 0
                            
                            # Track first chunk latency
                            if first_chunk_time is None:
                                first_chunk_time = time.time()
                                ttfc = int((first_chunk_time - start_time) * 1000)
                                logger.info(f"Sarvam TTS TTFC: {ttfc}ms")
                            
                            from sarvamai import AudioOutput
                            if isinstance(message, AudioOutput):
                                audio_b64 = cast(str, message.data.audio)
                                missing = (-len(audio_b64)) % 4
                                if missing:
                                    audio_b64 += "=" * missing
                                audio_chunk = base64.b64decode(audio_b64)
                                
                                # INSTANT delivery - zero buffering delays
                                if not self._first_chunk_sent:
                                    # First chunk: deliver immediately for instant playback
                                    chunk_count += 1
                                    logger.info(f"Sarvam TTS: INSTANT first chunk: {len(audio_chunk)} bytes")
                                    yield audio_chunk
                                    self._first_chunk_sent = True
                                else:
                                    # Subsequent chunks: minimal buffering for smooth playback
                                    self._audio_buffer.extend(audio_chunk)
                                    
                                    # Yield when buffer is full or timeout
                                    if len(self._audio_buffer) >= self._min_chunk_size:
                                        chunk_count += 1
                                        audio_to_yield = bytes(self._audio_buffer)
                                        logger.debug(f"Sarvam TTS: Chunk {chunk_count}: {len(audio_to_yield)} bytes")
                                        yield audio_to_yield
                                        self._audio_buffer.clear()
                            else:
                                logger.info(f"Sarvam TTS: Non-audio message: {type(message)} - {message}")
                                # Flush any remaining buffer before ending
                                if self._audio_buffer:
                                    chunk_count += 1
                                    audio_to_yield = bytes(self._audio_buffer)
                                    logger.debug(f"Sarvam TTS: Final buffered chunk {chunk_count}: {len(audio_to_yield)} bytes")
                                    yield audio_to_yield
                                    self._audio_buffer.clear()
                                
                                if chunk_count > 0:
                                    logger.info("Sarvam TTS: Stream complete (non-audio message)")
                                    break
                                else:
                                    logger.warning("Sarvam TTS: No audio chunks received before non-audio message")
                        
                        except asyncio.TimeoutError:
                            consecutive_timeouts += 1
                            
                            # Flush any buffered audio on timeout to prevent gaps
                            if self._audio_buffer:
                                chunk_count += 1
                                audio_to_yield = bytes(self._audio_buffer)
                                logger.debug(f"Sarvam TTS: Timeout flush chunk {chunk_count}: {len(audio_to_yield)} bytes")
                                yield audio_to_yield
                                self._audio_buffer.clear()
                            
                            continue
                            
                        except Exception as e:
                            logger.warning(f"Sarvam TTS: Message error: {e}")
                            if chunk_count > 0:
                                logger.info("Sarvam TTS: Stream likely complete (error after chunks)")
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
                    logger.debug(f"Sarvam TTS: Final flush chunk {chunk_count}: {len(audio_to_yield)} bytes")
                    yield audio_to_yield
                    self._audio_buffer.clear()
                
                # Log completion metrics
                total_time = int((time.time() - start_time) * 1000)
                logger.info(f"Sarvam TTS Stream Complete: {chunk_count} chunks, {total_time}ms total")
                        
        except Exception as e:
            elapsed = int((time.time() - start_time) * 1000)
            logger.error(f"Sarvam TTS Stream Error: {e} (after {elapsed}ms)", exc_info=True)

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
