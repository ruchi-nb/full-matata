"""
                                                                           Deepgram TTS Service - Production Grade
Handles text-to-speech functionality with optimized streaming, connection pooling, and error handling
                                                                           Deepgram TTS Service - Production Grade
Handles text-to-speech functionality with optimized streaming, connection pooling, and error handling
"""

import logging
import time
from typing import Optional, AsyncGenerator
import asyncio
import aiohttp
import ssl
from config import settings

logger = logging.getLogger(__name__)


class DeepgramTTSService:
    """Production-grade Deepgram TTS service with connection pooling and streaming optimization"""
    
    """Production-grade Deepgram TTS service with connection pooling and streaming optimization"""
    
    def __init__(self) -> None:
        self.api_key = settings.DEEPGRAM_API_KEY
        self.base_url = settings.DEEPGRAM_TTS_BASE_URL
        
        # Session will be created lazily for async operations
        self._session: Optional[aiohttp.ClientSession] = None
        self._session_lock = asyncio.Lock()
        
        # Connection pool configuration - Optimized for low latency
        self._connector_config = {
            'limit': 100,  # Max concurrent connections
            'limit_per_host': 20,  # Increased per host for better throughput
            'ttl_dns_cache': 600,  # Longer DNS cache TTL for stability
            'enable_cleanup_closed': True,
            'keepalive_timeout': 60,  # Keep connections alive longer
            'force_close': False  # Don't force close connections
        }
        
        # Timeout configuration - Optimized for streaming
        self._timeout_config = aiohttp.ClientTimeout(
            total=20,  # Reduced total timeout
            connect=3,  # Faster connection timeout
            sock_read=15  # Reduced socket read timeout for streaming
        )
        
        # Audio buffering for smooth playback - optimized to reduce pauses between chunks
        self._audio_buffer = bytearray()
        self._min_chunk_size = 512  # Smaller minimum chunk size for smoother streaming
        self._max_buffer_time = 0.01  # Max 10ms buffer time before yielding (very fast)
        self._first_chunk_sent = False  # Track if first chunk was sent
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session with connection pooling"""
        if self._session is None or self._session.closed:
            async with self._session_lock:
                if self._session is None or self._session.closed:
                    # Create SSL context with proper validation
                    ssl_context = ssl.create_default_context()
                    # For production, use proper cert validation
                    # ssl_context.check_hostname = True
                    # ssl_context.verify_mode = ssl.CERT_REQUIRED
                    
                    # Create connector with connection pooling
                    connector = aiohttp.TCPConnector(
                        ssl=ssl_context,
                        **self._connector_config
                    )
                    
                    self._session = aiohttp.ClientSession(
                        connector=connector,
                        timeout=self._timeout_config,
                        headers={
                            "Authorization": f"Token {self.api_key}",
                            "User-Agent": "MedicalVoiceAgent/1.0"
                        }
                    )
                    logger.info("Deepgram TTS session created with connection pooling")
        
        return self._session
    
    async def close(self):
        """Close the aiohttp session gracefully"""
        if self._session and not self._session.closed:
            await self._session.close()
            logger.info("🔒 Deepgram TTS session closed")
    
    async def tts_streaming(
        self, 
        text: str, 
        voice: str = None, 
        encoding: str = "mp3",
        request_id: str = None
    ) -> AsyncGenerator[bytes, None]:
        """
        Stream TTS audio chunks from Deepgram with ultra-low latency.
        
        Optimizations:
        - Connection pooling for reused connections
        - Optimized chunk sizes (8KB) for ~50ms audio
        - First byte latency tracking
        - Automatic retry on transient failures
        - Graceful error handling
        
        Args:
            text: Text to convert to speech
            voice: Deepgram voice model (e.g., 'aura-asteria-en')
            encoding: Audio encoding format (mp3, opus, linear16)
            request_id: Optional request ID for tracking
        
        Yields:
            Audio chunks as bytes
        """
        start_time = time.time()
        request_id = request_id or f"dg-tts-{int(time.time()*1000)}"
        
        # Reset first chunk flag for this streaming session
        self._first_chunk_sent = False
        
        try:
            # Use environment variable voice if not provided
            voice = voice or settings.DEEPGRAM_TTS_STREAMING_VOICE or "aura-asteria-en"
            
            # Build URL with optimized parameters
            url = f"{self.base_url}/speak"
            params = {
                "model": voice,
                "encoding": encoding,
            }
            
            # Add encoding-specific parameters
            # Note: MP3 doesn't support sample_rate parameter
            # Deepgram only supports 32000 or 48000 bit_rate for MP3
            if encoding == "mp3":
                params["bit_rate"] = 48000  # 48kbps for good quality (Deepgram requirement)
            elif encoding in ["linear16", "pcm"]:
                params["sample_rate"] = 16000
                params["container"] = "wav"
            elif encoding == "opus":
                params["sample_rate"] = 24000
            
            # Remove None values
            params = {k: v for k, v in params.items() if v is not None}
            
            headers = {
                "Content-Type": "application/json",
                "Accept": f"audio/{encoding}",
                "X-Request-ID": request_id
            }
            
            payload = {"text": text}
            
            logger.info(f"Deepgram TTS Streaming: text_len={len(text)}, voice={voice}, encoding={encoding}")
            
            # Get pooled session
            session = await self._get_session()
            
            # Make request with retry logic
            retry_count = 0
            max_retries = 2
            
            while retry_count <= max_retries:
                try:
                    async with session.post(
                        url,
                        params=params,
                        headers=headers,
                        json=payload
                    ) as resp:
                        # Check response status
                        if resp.status != 200:
                            error_text = await resp.text()
                            logger.error(f"Deepgram TTS HTTP {resp.status}: {error_text[:200]}")
                            
                            # Retry on 5xx errors
                            if resp.status >= 500 and retry_count < max_retries:
                                retry_count += 1
                                await asyncio.sleep(0.5 * retry_count)  # Exponential backoff
                                logger.warning(f"Retrying Deepgram TTS (attempt {retry_count + 1}/{max_retries + 1})")
                                continue
                            return
                        
                        # Track first byte latency and implement smart buffering with dynamic timeout
                        first_byte_time = None
                        chunk_count = 0
                        total_bytes = 0
                        buffer_start_time = None
                        last_chunk_time = time.time()
                        stream_start_time = time.time()
                        
                        # Stream with optimized chunk size for smooth, continuous playback
                        # Smaller chunks (2KB) for more frequent, smoother delivery
                        try:
                            async for chunk in resp.content.iter_chunked(2048):
                                if chunk:
                                    total_bytes += len(chunk)
                                    last_chunk_time = time.time()
                                    
                                    # Log first byte latency
                                    if first_byte_time is None:
                                        first_byte_time = time.time()
                                        ttfb_ms = int((first_byte_time - start_time) * 1000)
                                        logger.info(f"Deepgram TTS TTFB: {ttfb_ms}ms")
                                    
                                    # Add chunk to buffer
                                    self._audio_buffer.extend(chunk)
                                    
                                    # Initialize buffer timing
                                    if buffer_start_time is None:
                                        buffer_start_time = time.time()
                                    
                                    # Yield logic optimized for continuous playback
                                    current_time = time.time()
                                    buffer_duration = current_time - buffer_start_time
                                    
                                    should_yield = False
                                    
                                    # Always yield first chunk immediately (no buffering)
                                    if not self._first_chunk_sent and len(self._audio_buffer) > 0:
                                        should_yield = True
                                        self._first_chunk_sent = True
                                        logger.info(f"Deepgram TTS: IMMEDIATE first chunk: {len(self._audio_buffer)} bytes")
                                    
                                    # For subsequent chunks, yield more frequently to reduce pauses
                                    elif (len(self._audio_buffer) >= self._min_chunk_size or 
                                          buffer_duration >= self._max_buffer_time):
                                        should_yield = True
                                    
                                    # Yield the buffered audio
                                    if should_yield and self._audio_buffer:
                                        chunk_count += 1
                                        audio_to_yield = bytes(self._audio_buffer)
                                        logger.debug(f"Deepgram TTS: Chunk {chunk_count}: {len(audio_to_yield)} bytes")
                                        yield audio_to_yield
                                        self._audio_buffer.clear()
                                        buffer_start_time = None
                                
                                # Log progress for debugging
                                if chunk_count > 0 and chunk_count % 10 == 0:
                                    logger.debug(f"Deepgram TTS: Processed {chunk_count} chunks, {total_bytes} bytes so far")
                                
                            # Stream completed naturally
                            logger.info("📡 Deepgram TTS: Stream ended naturally")
                            
                        except Exception as stream_error:
                            logger.warning(f"Deepgram TTS: Stream error: {stream_error}")
                            
                            # Check for inactivity timeout
                            current_time = time.time()
                            time_since_last_chunk = current_time - last_chunk_time
                            
                            if time_since_last_chunk > 5.0 and chunk_count > 0:
                                logger.info(f"Deepgram TTS: Stream complete after {time_since_last_chunk:.1f}s inactivity ({chunk_count} chunks total)")
                            elif time_since_last_chunk > 10.0 and chunk_count == 0:
                                logger.warning(f"Deepgram TTS: No chunks received for {time_since_last_chunk:.1f}s - aborting")
                            else:
                                logger.info(f"📡 Deepgram TTS: Stream ended with {chunk_count} chunks")
                        
                        # Final flush of any remaining buffered audio
                        if self._audio_buffer:
                            chunk_count += 1
                            audio_to_yield = bytes(self._audio_buffer)
                            logger.debug(f"Deepgram TTS: Final flush chunk {chunk_count}: {len(audio_to_yield)} bytes")
                            yield audio_to_yield
                            self._audio_buffer.clear()
                        
                        # Log completion metrics
                        total_time = int((time.time() - start_time) * 1000)
                        logger.info(
                            f"Deepgram TTS Complete: {chunk_count} chunks, "
                            f"{total_bytes} bytes, {total_time}ms total"
                        )
                        break  # Success, exit retry loop
                        
                except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                    if retry_count < max_retries:
                        retry_count += 1
                        await asyncio.sleep(0.5 * retry_count)
                        logger.warning(f"🔄 Retrying Deepgram TTS after error: {e} (attempt {retry_count + 1}/{max_retries + 1})")
                        continue
                    else:
                        logger.error(f"❌ Deepgram TTS failed after {max_retries} retries: {e}")
                        raise
                        
        except Exception as e:
            elapsed = int((time.time() - start_time) * 1000)
            logger.error(f"❌ Deepgram TTS Error: {e} (after {elapsed}ms)", exc_info=True)
            return
    
    async def tts_batch(
        self, 
        text: str, 
        voice: str = None, 
        encoding: str = "linear16",
        request_id: str = None
    ) -> Optional[bytes]:
        """
        Generate complete TTS audio in one request (non-streaming).
        Useful for caching or when full audio is needed upfront.
        
        Args:
            text: Text to convert to speech
            voice: Deepgram voice model
            encoding: Audio encoding format
            request_id: Optional request ID for tracking
        
        Returns:
            Complete audio as bytes, or None on error
        """
        start_time = time.time()
        request_id = request_id or f"dg-tts-batch-{int(time.time()*1000)}"
        
        try:
            voice = voice or settings.DEEPGRAM_TTS_VOICE or "aura-asteria-en"
            
            url = f"{self.base_url}/speak"
            params = {
                "model": voice,
                "encoding": encoding,
            }
            
            # Add encoding-specific parameters
            if encoding == "mp3":
                params["bit_rate"] = 48000  # Deepgram requirement: 32000 or 48000
            elif encoding in ["linear16", "pcm"]:
                params["sample_rate"] = 16000
                params["container"] = "wav"
            elif encoding == "opus":
                params["sample_rate"] = 24000
            
            # Remove None values
            params = {k: v for k, v in params.items() if v is not None}
            
            headers = {
                "Content-Type": "application/json",
                "Accept": "audio/wav" if encoding == "linear16" else f"audio/{encoding}",
                "X-Request-ID": request_id
            }
            
            
            payload = {"text": text}
            
            logger.info(f"🎤 [Deepgram TTS Batch] text_len={len(text)}, voice={voice}")
            
            session = await self._get_session()
            
            async with session.post(url, params=params, headers=headers, json=payload) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    logger.error(f"❌ Deepgram TTS Batch HTTP {resp.status}: {error_text[:200]}")
                    return None
                
                audio_data = await resp.read()
                elapsed = int((time.time() - start_time) * 1000)
                
                logger.info(f"✅ Deepgram TTS Batch: {len(audio_data)} bytes, {elapsed}ms")
                return audio_data
                
        except Exception as e:
            elapsed = int((time.time() - start_time) * 1000)
            logger.error(f"❌ Deepgram TTS Batch Error: {e} (after {elapsed}ms)", exc_info=True)
            return None
    
    def __del__(self):
        """Cleanup on deletion"""
        if self._session and not self._session.closed:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(self.close())
                else:
                    loop.run_until_complete(self.close())
            except Exception:
                pass  # Best effort cleanup
