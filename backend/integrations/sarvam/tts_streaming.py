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
        
        # Performance tuning
        self._config_timeout = 3.0  # Configuration timeout
        self._convert_timeout = 3.0  # Text conversion timeout
        self._flush_timeout = 2.0  # Flush timeout
        self._chunk_timeout = 0.15  # 150ms per chunk (ultra-fast)
        self._stream_timeout = 10.0  # Overall stream timeout
        self._inactivity_threshold = 4  # 4 × 150ms = 600ms inactivity detection

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
                        
                        # Stream audio chunks with ultra-low latency
                        timeout_task = asyncio.create_task(asyncio.sleep(self._stream_timeout))
                        message_task = None
                        chunk_count = 0
                        last_chunk_time = time.time()
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
                                        timeout=self._chunk_timeout  # 150ms - ultra-fast
                                    )
                                    
                                    if timeout_task in done:
                                        logger.info("⏱️ Sarvam TTS: Overall timeout reached")
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
                                            
                                            # Yield chunks immediately for real-time playback
                                            chunk_count += 1
                                            logger.debug(f"🎵 Sarvam TTS: Chunk {chunk_count}: {len(audio_chunk)} bytes")
                                            yield audio_chunk
                                        else:
                                            logger.debug(f"📨 Sarvam TTS: Non-audio message: {type(message)}")
                                            if chunk_count > 0:
                                                logger.info("✅ Sarvam TTS: Stream complete (non-audio message)")
                                                break
                                        
                                except asyncio.TimeoutError:
                                    consecutive_timeouts += 1
                                    
                                    # PRODUCTION TUNING: 4 × 150ms = 600ms inactivity detection
                                    # Fast enough for real-time, reliable enough to not cut off
                                    if consecutive_timeouts >= self._inactivity_threshold and chunk_count > 0:
                                        elapsed = consecutive_timeouts * self._chunk_timeout
                                        logger.info(f"✅ Sarvam TTS: Stream complete after {elapsed:.1f}s inactivity")
                                        break
                                    
                                    # Fallback: 3 second hard timeout if no chunks at all
                                    if time.time() - last_chunk_time > 3.0 and chunk_count == 0:
                                        logger.warning("⚠️ Sarvam TTS: No chunks received for 3 seconds - aborting")
                                        break
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
                            if timeout_task and not timeout_task.done():
                                timeout_task.cancel()
                            if message_task and not message_task.done():
                                message_task.cancel()
                        
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
