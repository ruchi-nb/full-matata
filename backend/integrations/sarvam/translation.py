"""
Sarvam Translation Service - ULTRA-OPTIMIZED
Handles text translation functionality with async requests and connection pooling
"""

import logging
import time
import asyncio
import aiohttp
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)


class SarvamTranslationService:
    def __init__(self):
        self.api_key = settings.SARVAM_API_KEY
        self.base_url = settings.SARVAM_BASE_URL
        self.headers = {
            "Content-Type": "application/json",
            "api-subscription-key": self.api_key
        }
        
        # Connection pooling for better performance (per-event-loop)
        # Keep separate sessions and locks per event loop to avoid cross-loop issues
        self._sessions_by_loop = {}  # key: id(loop) -> aiohttp.ClientSession
        self._locks_by_loop = {}     # key: id(loop) -> asyncio.Lock
        
        # ULTRA-FAST timeout configuration - optimized for minimal latency
        self._timeout_config = aiohttp.ClientTimeout(
            total=3,  # 3 second total timeout (ultra-fast)
            connect=1,  # 1 second connection timeout (ultra-fast)
            sock_read=2  # 2 second socket read timeout (ultra-fast)
        )
        
        # Connection pool configuration
        self._connector_config = {
            'limit': 50,  # Max concurrent connections
            'limit_per_host': 10,  # Max per host
            'ttl_dns_cache': 300,  # DNS cache TTL
            'enable_cleanup_closed': True,
            'keepalive_timeout': 30,  # Keep connections alive
            'force_close': False
        }
        
        # Translation cache for frequently translated text
        self._translation_cache = {}
        self._cache_max_size = 1000
        self._cache_ttl = 3600  # 1 hour cache TTL
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session with connection pooling bound to the current event loop"""
        loop = asyncio.get_running_loop()
        key = id(loop)

        lock = self._locks_by_loop.get(key)
        if lock is None:
            # Create lock bound to the current loop
            lock = asyncio.Lock()
            self._locks_by_loop[key] = lock

        async with lock:
            session: Optional[aiohttp.ClientSession] = self._sessions_by_loop.get(key)
            if session is None or session.closed:
                connector = aiohttp.TCPConnector(**self._connector_config)
                session = aiohttp.ClientSession(
                    connector=connector,
                    timeout=self._timeout_config,
                    headers=self.headers
                )
                self._sessions_by_loop[key] = session
                logger.info("✅ Sarvam Translation session created with connection pooling (per event loop)")

            return session
    
    async def close(self):
        """Close the aiohttp session for the current event loop gracefully"""
        try:
            loop = asyncio.get_running_loop()
            key = id(loop)
            session: Optional[aiohttp.ClientSession] = self._sessions_by_loop.get(key)
            if session and not session.closed:
                await session.close()
                logger.info("🔒 Sarvam Translation session closed (current event loop)")
        except RuntimeError:
            # No running loop; nothing to close here
            pass

    async def _reset_current_loop_session(self):
        """Best-effort reset of the session for the current event loop (on loop-attachment errors)."""
        loop = asyncio.get_running_loop()
        key = id(loop)
        lock = self._locks_by_loop.get(key)
        if lock is None:
            lock = asyncio.Lock()
            self._locks_by_loop[key] = lock
        async with lock:
            session: Optional[aiohttp.ClientSession] = self._sessions_by_loop.get(key)
            if session and not session.closed:
                try:
                    await session.close()
                except Exception:
                    pass
            self._sessions_by_loop[key] = None

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
            "en": "en-IN",
            "multi": "auto",
            "auto": "auto"
        }
        if lang_code in lang_map:
            return lang_map[lang_code]
        elif lang_code and "-IN" in lang_code:
            return lang_code
        else:
            return "auto"

    def speech_translate(self, audio_file_path: str, source_lang: str = "hi", target_lang: str = "en") -> Optional[str]:
        """Convert audio speech to text in target language (for Sarvam Test routes only)"""
        try:
            url = f"{self.base_url}/speech-to-text"
            with open(audio_file_path, 'rb') as audio_file:
                files = {
                    'file': (audio_file_path.split('/')[-1], audio_file, 'audio/wav')
                }
                data = {
                    'language_code': self._convert_lang_code(source_lang)
                }
                headers = {"api-subscription-key": self.api_key}
                # Note: This method is unused and should be removed or updated to use async
                # For now, returning None to avoid errors
                logger.warning("Speech translation method is deprecated and unused")
                return None

            if target_lang != source_lang and transcribed_text:
                return self.text_translate(transcribed_text, source_lang, target_lang)

            return transcribed_text

        except Exception as e:
            logger.error(f"Speech translation error: {str(e)}")
            try:
                error_response = e.response.text if hasattr(e, 'response') else str(e)
                logger.error(f"Sarvam API response: {error_response}")
            except:
                pass
            return None

    async def text_translate_async(self, text: str, source_lang: str = "en", target_lang: str = "hi", 
                                  request_id: str = None, session_id: str = None) -> Optional[str]:
        """Translate text from source to target language with async requests and ultra-fast timeouts"""
        start_time = time.time()
        request_id = request_id or f"trans-{int(time.time()*1000)}"
        
        try:
            print(f"TRANSLATE REQUEST: '{text}' from {source_lang} to {target_lang}")
            
            # Check if event loop is still running
            try:
                loop = asyncio.get_running_loop()
                if loop.is_closed():
                    logger.warning("Event loop is closed, falling back to sync translation")
                    return self._fallback_sync_translate(text, source_lang, target_lang)
            except RuntimeError:
                logger.warning("No event loop running, falling back to sync translation")
                return self._fallback_sync_translate(text, source_lang, target_lang)
            
            source_lang_converted = self._convert_lang_code(source_lang)
            target_lang_converted = self._convert_lang_code(target_lang)
            
            if source_lang_converted == target_lang_converted:
                return text
            
            # Check translation cache first for ultra-fast response
            cache_key = f"{source_lang_converted}:{target_lang_converted}:{hash(text)}"
            if cache_key in self._translation_cache:
                cached_result, cache_time = self._translation_cache[cache_key]
                if time.time() - cache_time < self._cache_ttl:
                    logger.debug(f"🚀 Translation cache HIT: {cache_key}")
                    return cached_result
                else:
                    # Remove expired cache entry
                    del self._translation_cache[cache_key]

            url = f"{self.base_url}/translate"
            payload = {
                "input": text,
                "source_language_code": source_lang_converted,
                "target_language_code": target_lang_converted,
                "speaker_gender": "Male",
                "mode": "formal",
                "model": settings.SARVAM_TRANSLATE_MODEL,
                "enable_preprocessing": False,
                "instruction": "Translate strictly and literally. Do not summarize, expand, or add content."
            }

            session = await self._get_session()
            
            # Retry logic with exponential backoff
            max_retries = 2
            for attempt in range(max_retries + 1):
                try:
                    async with session.post(url, json=payload) as response:
                        if response.status == 200:
                            result = await response.json()
                            translated = result.get('translated_text', text)
                            print(f"TRANSLATE RESULT: '{translated}'")
                            
                            # Validate translation length
                            if len(text) > 0 and len(translated) > max(512, 3 * len(text)):
                                logger.warning("Translation length anomaly detected")
                                # Return original if translation is too long
                                translated = text
                            
                            if not translated or translated.strip() == "":
                                logger.warning("Empty translation received, returning original text")
                                translated = text

                            # Cache the translation result for future use
                            if len(self._translation_cache) >= self._cache_max_size:
                                # Remove oldest entry if cache is full
                                oldest_key = min(self._translation_cache.keys(), 
                                               key=lambda k: self._translation_cache[k][1])
                                del self._translation_cache[oldest_key]
                            
                            self._translation_cache[cache_key] = (translated, time.time())
                            
                            # Log success metrics
                            latency_ms = int((time.time() - start_time) * 1000)
                            logger.info(f"Sarvam Translation - Input: {len(text)} chars, Output: {len(translated)} chars, Latency: {latency_ms}ms, {source_lang_converted}->{target_lang_converted}")
                            logger.info(f"Translation completed: {source_lang_converted} -> {target_lang_converted}")
                            
                            return translated
                        else:
                            error_text = await response.text()
                            logger.error(f"Sarvam API error: {response.status} - {error_text}")
                            if attempt < max_retries:
                                await asyncio.sleep(0.5 * (attempt + 1))  # Exponential backoff
                                continue
                            return text
                            
                except asyncio.TimeoutError:
                    if attempt < max_retries:
                        logger.warning(f"Translation timeout, retrying (attempt {attempt + 1}/{max_retries + 1})")
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                    else:
                        logger.error("Translation timeout after all retries")
                        return text
                except Exception as e:
                    # Handle cross-event-loop attachment errors by resetting the session for this loop
                    if "attached to a different loop" in str(e):
                        logger.warning("Detected cross-loop session usage, resetting session for current loop")
                        try:
                            await self._reset_current_loop_session()
                        except Exception:
                            pass
                    if attempt < max_retries:
                        logger.warning(f"Translation error, retrying: {e} (attempt {attempt + 1}/{max_retries + 1})")
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                    else:
                        raise e
            
            return text

        except Exception as e:
            logger.error(f"Text translation error: {str(e)}")
            
            # Handle specific "Event loop is closed" error
            if "Event loop is closed" in str(e):
                logger.warning("Event loop closed during translation, falling back to sync method")
                try:
                    return self._fallback_sync_translate(text, source_lang, target_lang)
                except Exception as fallback_error:
                    logger.error(f"Fallback sync translation also failed: {fallback_error}")
                    return text
            
            # Log error metrics
            try:
                latency_ms = int((time.time() - start_time) * 1000)
                logger.error(f"Sarvam Translation Error - Input: {len(text)} chars, Latency: {latency_ms}ms, Error: {str(e)}")
            except Exception as log_error:
                logger.warning(f"Analytics logging failed: {log_error}")
            
            return text
    
    def text_translate(self, text: str, source_lang: str = "en", target_lang: str = "hi", 
                      request_id: str = None, session_id: str = None) -> Optional[str]:
        """ULTRA-FAST synchronous wrapper for async translation"""
        try:
            # Check cache first for instant response
            source_lang_converted = self._convert_lang_code(source_lang)
            target_lang_converted = self._convert_lang_code(target_lang)
            
            if source_lang_converted == target_lang_converted:
                return text
            
            cache_key = f"{source_lang_converted}:{target_lang_converted}:{hash(text)}"
            if cache_key in self._translation_cache:
                cached_result, cache_time = self._translation_cache[cache_key]
                if time.time() - cache_time < self._cache_ttl:
                    logger.debug(f"🚀 Translation cache HIT (sync): {cache_key}")
                    return cached_result
            
            # Try to get the current event loop
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If we're in an async context, create a new event loop in a thread
                import concurrent.futures
                import threading
                
                def run_in_thread():
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    try:
                        return new_loop.run_until_complete(
                            self.text_translate_async(text, source_lang, target_lang, request_id, session_id)
                        )
                    finally:
                        new_loop.close()
                
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(run_in_thread)
                    return future.result(timeout=5)  # Reduced timeout to 5 seconds
            else:
                # If no loop is running, we can use asyncio.run
                return asyncio.run(self.text_translate_async(text, source_lang, target_lang, request_id, session_id))
        except Exception as e:
            logger.error(f"Sync translation wrapper error: {e}")
            # Fallback to simple synchronous translation for critical cases
            return self._fallback_sync_translate(text, source_lang, target_lang)
    
    def _fallback_sync_translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """Ultra-fast fallback synchronous translation using requests"""
        try:
            import requests
            
            source_lang_converted = self._convert_lang_code(source_lang)
            target_lang_converted = self._convert_lang_code(target_lang)
            
            if source_lang_converted == target_lang_converted:
                return text
            
            url = f"{self.base_url}/translate"
            payload = {
                "input": text,
                "source_language_code": source_lang_converted,
                "target_language_code": target_lang_converted,
                "speaker_gender": "Male",
                "mode": "formal",
                "model": settings.SARVAM_TRANSLATE_MODEL,
                "enable_preprocessing": False,
                "instruction": "Translate strictly and literally. Do not summarize, expand, or add content."
            }
            
            # Ultra-fast synchronous request with minimal timeout
            response = requests.post(url, json=payload, headers=self.headers, timeout=2)
            if response.status_code == 200:
                result = response.json()
                translated = result.get('translated_text', text)
                
                # Cache the result
                cache_key = f"{source_lang_converted}:{target_lang_converted}:{hash(text)}"
                if len(self._translation_cache) >= self._cache_max_size:
                    oldest_key = min(self._translation_cache.keys(), 
                                   key=lambda k: self._translation_cache[k][1])
                    del self._translation_cache[oldest_key]
                self._translation_cache[cache_key] = (translated, time.time())
                
                logger.info(f"🚀 Fallback sync translation: {len(text)} chars -> {len(translated)} chars")
                return translated
            else:
                logger.error(f"Fallback sync translation failed: {response.status_code}")
                return text
                
        except Exception as e:
            logger.error(f"Fallback sync translation error: {e}")
            return text
