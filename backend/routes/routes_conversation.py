from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import StreamingResponse, HTMLResponse, PlainTextResponse, JSONResponse
from typing import Optional, Dict, Tuple, Any
from io import BytesIO
from pydub import AudioSegment
import logging
import base64
import time
import asyncio
from pydantic import BaseModel

from integrations.unified_services import sarvam_service, deepgram_service, openai_service
import os
import struct
from sqlalchemy.ext.asyncio import AsyncSession
from database.database import get_db, AsyncSessionLocal
from service.consultation_service import (
    open_session, record_turn, create_consultation, get_or_create_session,
    save_transcript, get_session_transcript_text, append_message
)
from dependencies.dependencies import require_permissions, get_current_user


logger = logging.getLogger(__name__)
router = APIRouter()

# ========================================
# PHASE 1 OPTIMIZATIONS: CACHING & PERFORMANCE
# ========================================

class SystemPromptCache:
    """Cache system prompts to avoid repeated database queries - Production Ready"""
    
    def __init__(self):
        self._cache: Dict[str, Tuple[str, float]] = {}
        self._cache_ttl = 3600  # 1 hour cache TTL
        self._max_cache_size = 1000  # Prevent memory bloat
    
    def _cleanup_cache(self):
        """LRU cleanup when cache gets too large"""
        if len(self._cache) > self._max_cache_size:
            # Remove oldest entries
            sorted_items = sorted(self._cache.items(), key=lambda x: x[1][1])
            for key, _ in sorted_items[:len(self._cache) // 4]:  # Remove 25%
                del self._cache[key]
    
    async def get_system_prompt(self, db: AsyncSession, doctor_id: int, consultation_id: Optional[int] = None) -> str:
        cache_key = f"{doctor_id}_{consultation_id or 'default'}"
        current_time = time.time()
        
        # Check cache first
        if cache_key in self._cache:
            prompt, timestamp = self._cache[cache_key]
            if current_time - timestamp < self._cache_ttl:
                return prompt
        
        # Fetch from database
        try:
            from system_prompt import get_dynamic_system_prompt
            prompt = await get_dynamic_system_prompt(db, doctor_id, consultation_id)
            
            # Cleanup cache if needed
            self._cleanup_cache()
            
            # Cache the result
            self._cache[cache_key] = (prompt, current_time)
            return prompt
        except Exception as e:
            logger.warning(f"System prompt cache miss, using default: {e}")
            from system_prompt import VIRTUAL_DOCTOR_SYSTEM_PROMPT
            return VIRTUAL_DOCTOR_SYSTEM_PROMPT

# Global cache instances
system_prompt_cache = SystemPromptCache()

# Database operation queue to prevent too many concurrent operations
_database_operation_semaphore = asyncio.Semaphore(5)  # Max 5 concurrent DB operations

# Circuit breaker for database operations
_database_failure_count = 0
_database_failure_threshold = 10
_database_circuit_breaker_reset_time = 60  # seconds

# Response cache for ultra-fast responses
_response_cache = {}
_response_cache_ttl = 300  # 5 minutes

# ========================================
# ASYNC LOGGING FUNCTIONS WITH DEADLOCK PROTECTION
# ========================================

async def _retry_database_operation(operation, max_retries=3, delay=0.1):
    """Retry database operations with exponential backoff to handle deadlocks"""
    global _database_failure_count
    
    # Check circuit breaker
    if _database_failure_count >= _database_failure_threshold:
        logger.warning("Database circuit breaker open - skipping operation to prevent cascading failures")
        return None
    
    async with _database_operation_semaphore:  # Limit concurrent operations
        for attempt in range(max_retries):
            try:
                result = await operation()
                # Reset failure count on success
                _database_failure_count = 0
                return result
            except Exception as e:
                _database_failure_count += 1
                if "Deadlock found" in str(e) or "try restarting transaction" in str(e):
                    if attempt < max_retries - 1:
                        wait_time = delay * (2 ** attempt)  # Exponential backoff
                        logger.warning(f"Database deadlock detected, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(wait_time)
                        continue
                raise e
        return None

async def log_messages_async(
    session_db_id: int,
    patient_message: str,
    assistant_message: str,
    patient_processing_time: int,
    assistant_processing_time: int
) -> None:
    """Log both messages with deadlock protection and retry mechanism"""
    
    async def log_patient():
        try:
            async with AsyncSessionLocal() as async_db:
                await _retry_database_operation(
                    lambda: asyncio.wait_for(
                        append_message(
                            async_db,
                            session_id=session_db_id,
                            sender_type="patient",
                            message_text=patient_message,
                            audio_url=None,
                            processing_time_ms=patient_processing_time
                        ),
                        timeout=10.0
                    )
                )
        except Exception as e:
            logger.warning(f"Async patient message logging failed for session {session_db_id}: {e}")
    
    async def log_assistant():
        try:
            async with AsyncSessionLocal() as async_db:
                await _retry_database_operation(
                    lambda: asyncio.wait_for(
                        append_message(
                            async_db,
                            session_id=session_db_id,
                            sender_type="assistant",
                            message_text=assistant_message,
                            audio_url=None,
                            processing_time_ms=assistant_processing_time
                        ),
                        timeout=10.0
                    )
                )
        except Exception as e:
            logger.warning(f"Async assistant message logging failed for session {session_db_id}: {e}")
    
    # Execute operations sequentially to avoid deadlocks
    try:
        await asyncio.wait_for(
            asyncio.gather(
                log_patient(),
                log_assistant(),
                return_exceptions=True
            ),
            timeout=30.0  # Increased timeout for retry mechanism
        )
    except asyncio.TimeoutError:
        logger.warning(f"Message logging timed out for session {session_db_id}")
    except Exception as e:
        logger.warning(f"Message logging failed for session {session_db_id}: {e}")

async def log_api_usage_async(
    consultation_id: int,
    session_db_id: int,
    text: str,
    response: str,
    total_latency_ms: int,
    lang: str,
    use_rag_flag: bool
):
    """Log API usage asynchronously with deadlock protection and retry mechanism"""
    
    try:
        async with AsyncSessionLocal() as async_db:
            from service.consultation_service import log_conversation_apis
            
            await _retry_database_operation(
                lambda: asyncio.wait_for(
                    log_conversation_apis(
                        db=async_db,
                        consultation_id=consultation_id,
                        session_db_id=session_db_id,
                        openai_tokens=(len(text.split()), len(response.split())),
                        openai_latency=total_latency_ms,
                        translation_data=(len(text), len(response), total_latency_ms // 3) if lang != "en" else None,
                        rag_data=(len(text), 150) if use_rag_flag and not _is_trivial_utterance(text) else None
                    ),
                    timeout=15.0
                )
            )
    except Exception as e:
        logger.warning(f"Async API usage logging failed for session {session_db_id}: {e}")

async def log_speech_apis_async(
    consultation_id: int,
    session_db_id: int,
    stt_provider: str,
    raw_audio: bytes,
    transcribed_text: str,
    final_response: str,
    stt_latency_ms: int,
    total_latency_ms: int,
    lang: str,
    use_rag_flag: bool
):
    """Log speech API usage asynchronously with deadlock protection and retry mechanism"""
    
    try:
        async with AsyncSessionLocal() as async_db:
            from service.consultation_service import log_speech_apis
            
            await _retry_database_operation(
                lambda: asyncio.wait_for(
                    log_speech_apis(
                        db=async_db,
                        consultation_id=consultation_id,
                        session_db_id=session_db_id,
                        stt_provider=stt_provider,
                        stt_data=(len(raw_audio) / 32000, stt_latency_ms, transcribed_text),
                        openai_tokens=(len(transcribed_text.split()), len(final_response.split())),
                        openai_latency=(total_latency_ms - stt_latency_ms),
                        translation_data=(len(transcribed_text), len(final_response), total_latency_ms // 4) if lang != "en" else None,
                        rag_data=(len(transcribed_text), 200) if use_rag_flag and not _is_trivial_utterance(transcribed_text) else None
                    ),
                    timeout=15.0
                )
            )
    except Exception as e:
        logger.warning(f"Async speech API logging failed for session {session_db_id}: {e}")

class ConsultationCreate(BaseModel):
    patient_id: int
    doctor_id: int
    specialty_id: int
    hospital_id: Optional[int] = None
    consultation_type: str = "hospital"


def webm_to_wav_bytes(webm_bytes: bytes) -> bytes:
    try:
        # Validate WebM data before processing
        if len(webm_bytes) < 50:
            raise ValueError("WebM data too short")
        
        # Check for WebM header (starts with 0x1A45DFA3)
        if not webm_bytes.startswith(b'\x1a\x45\xdf\xa3'):
            raise ValueError("Invalid WebM header")
        
        audio = AudioSegment.from_file(BytesIO(webm_bytes), format="webm")
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        out = BytesIO()
        audio.export(out, format="wav", codec="pcm_s16le")
        return out.getvalue()
    except Exception as e:
        logger.error(f"WebM to WAV conversion failed: {e}")
        logger.error(f"WebM data length: {len(webm_bytes)} bytes")
        logger.error(f"WebM data start: {webm_bytes[:20].hex() if len(webm_bytes) >= 20 else webm_bytes.hex()}")
        raise ValueError(f"Failed to convert WebM audio: {str(e)}")


# Lightweight detector for trivial/greeting/ack utterances. Used to skip RAG.
def _is_trivial_utterance(text: str) -> bool:
    if not text:
        return True
    t = (text or "").strip().lower()
    if len(t) <= 2:
        return True
    # Single-word greetings/acks/common fillers
    trivial_words = {
        "ok", "okay", "okk", "k", "kk", "hmm", "hmmm", "h", "hii", "hi", "hello",
        "hey", "yo", "sup", "thanks", "thankyou", "thank you", "cool", "nice",
        "great", "fine", "good", "awesome", "sure", "yup", "yeah", "nope", "no",
        "yes", "hahaha", "haha", "lol", "hbd", "bye", "goodbye", "tc", "hru", "hello doctor"
    }
    # If it's a single token and in set, treat as trivial
    tokens = t.split()
    if len(tokens) == 1 and tokens[0] in trivial_words:
        return True
    # Very short generic phrases
    short_trivial_phrases = {"okay doctor", "ok doctor", "hello doctor", "hi doctor"}
    if t in short_trivial_phrases:
        return True
    return False


@router.post("/consultation/create")
async def create_consultation_endpoint(
    consultation: ConsultationCreate,
    caller: Dict[str, Any] = Depends(require_permissions(["consultation.create"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    try:
        consultation_id = await create_consultation(
            db,
            patient_id=consultation.patient_id,
            doctor_id=consultation.doctor_id,
            specialty_id=consultation.specialty_id,
            hospital_id=consultation.hospital_id,
            consultation_type=consultation.consultation_type
        )
        
        
        return {"status": "success", "consultation_id": consultation_id}
    except Exception as e:
        logger.error(f"Error creating consultation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversation/text")
async def conversation_text(
    text: str = Form(...),
    session_id: Optional[str] = Form(None),
    language: Optional[str] = Form("en"),
    use_rag: Optional[str] = Form(None),
    consultation_id: Optional[int] = Form(None),
    session_db_id: Optional[int] = Form(None),
    caller: Dict[str, Any] = Depends(require_permissions(["conversation.text"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    request_id = f"req-{int(time.time()*1000)}"
    # Use provided session_id or create a new one
    if not session_id:
        session_id = f"session-{int(time.time())}"
    start_time = time.time()
    
    try:
        logger.info(f"conversation_text: text_len={len(text)} consultation_id={consultation_id} request_id={request_id}")
        
        # Pipeline: Language-based routing (no auto-detection)
        lang = (language or "en").split("-")[0].lower()
        
        # Smart RAG usage - skip RAG for simple queries
        use_rag_flag = True
        
        # Ultra-fast path: skip RAG ONLY for very simple queries
        simple_queries = ["hello", "hi", "ok", "thanks", "thank you", "yes", "no", "okay", "sure", "alright", "fine", "good", "great", "nice", "cool"]
        # Only check exact matches for simple queries - everything else uses RAG
        text_lower = text.lower().strip()
        if text_lower in simple_queries:
            use_rag_flag = False
            logger.info(f"⚡ Ultra-fast path: Skipping RAG for simple query '{text}'")
        else:
            use_rag_flag = True
            logger.info(f"🔍 Using RAG for query: '{text[:50]}...'")
        

        # OPTIMIZATION 1: Always get dynamic system prompt from database
        dynamic_system_prompt = None
        consultation = None
        
        if consultation_id:
            try:
                # Get consultation details first to get doctor_id
                from service.consultation_service import get_consultation_details
                consultation = await get_consultation_details(db, consultation_id=consultation_id)
                
                if consultation and consultation.doctor_id:
                    # Get dynamic system prompt using actual doctor_id from consultation
                    dynamic_system_prompt = await system_prompt_cache.get_system_prompt(
                        db, consultation.doctor_id, consultation_id
                    )
                    logger.info(f"✅ Using dynamic system prompt for Dr. ID {consultation.doctor_id}")
                else:
                    # Fallback to default if no consultation or doctor_id
                    from system_prompt import VIRTUAL_DOCTOR_SYSTEM_PROMPT
                    dynamic_system_prompt = VIRTUAL_DOCTOR_SYSTEM_PROMPT
                    logger.warning("⚠️ No consultation or doctor_id found, using default prompt")
            except Exception as e:
                logger.warning(f"⚠️ Could not get dynamic system prompt: {e}")
                # Ensure we always have a system prompt
                from system_prompt import VIRTUAL_DOCTOR_SYSTEM_PROMPT
                dynamic_system_prompt = VIRTUAL_DOCTOR_SYSTEM_PROMPT
        else:
            # No consultation_id provided, use default prompt
            from system_prompt import VIRTUAL_DOCTOR_SYSTEM_PROMPT
            dynamic_system_prompt = VIRTUAL_DOCTOR_SYSTEM_PROMPT
            logger.warning("⚠️ No consultation_id provided, using default prompt")

        if lang == "en":
            # OPTIMIZATION 2: Check response cache first
            cache_key = f"{text.lower().strip()}_{consultation_id or 'default'}"
            current_time = time.time()
            
            if cache_key in _response_cache:
                cached_response, timestamp = _response_cache[cache_key]
                if current_time - timestamp < _response_cache_ttl:
                    logger.info(f"✅ Response cache HIT for: {text[:50]}...")
                    response = cached_response
                else:
                    # Cache expired, remove it
                    del _response_cache[cache_key]
            
            if 'response' not in locals():
                # OPTIMIZATION 3: Always use RAG regardless of latency
                try:
                    if use_rag_flag:
                        # Always use RAG - no timeout, no skipping
                        logger.info(f"🔍 Using RAG for query: '{text[:50]}...' (no latency limits)")
                        response = ""
                        stream_gen = openai_service.generate_response_stream(
                            prompt=f"Patient question: {text}",
                            max_tokens=200,
                            temperature=0.2,
                            top_p=0.9,
                            request_id=request_id,
                            session_id=session_id,
                            use_rag=True,  # Always use RAG
                            user_language="en",
                            system_prompt=dynamic_system_prompt
                        )
                        
                        # Collect all tokens from generator
                        for token in stream_gen:
                            response += token
                    else:
                        # Direct prompt without RAG (only for simple queries)
                        logger.info(f"⚡ Skipping RAG for simple query: '{text[:50]}...'")
                        response = ""
                        stream_gen = openai_service.generate_response_stream(
                            prompt=f"Patient question: {text}",
                            max_tokens=200,
                            temperature=0.2,
                            top_p=0.9,
                            request_id=request_id,
                            session_id=session_id,
                            use_rag=False,
                            user_language="en",
                            system_prompt=dynamic_system_prompt
                        )
                        
                        # Collect all tokens from generator
                        for token in stream_gen:
                            response += token
                except Exception as e:
                    # Fallback to non-streaming if streaming fails
                    logger.warning(f"Streaming failed, using fallback: {e}")
                    response = openai_service.generate_response(
                        prompt=f"Patient question: {text}",
                        max_tokens=200,
                        temperature=0.2,
                        top_p=0.9,
                        request_id=request_id,
                        session_id=session_id,
                        use_rag=use_rag_flag,  # Use RAG in fallback too
                        user_language="en",
                        system_prompt=dynamic_system_prompt,
                        use_cache=True
                    )
                
                # Cache the response for future requests
                _response_cache[cache_key] = (response, current_time)
                logger.info(f"✅ Response cached for: {text[:50]}...")
            prompt_text = text
        else:
            # Non-English: ULTRA-FAST async translation -> ChatGPT (RAG) -> async translate back
            # Use async translation for much faster processing
            prompt_text = await sarvam_service.translation_service.text_translate_async(
                text, source_lang=lang, target_lang="en", request_id=request_id, session_id=session_id
            ) or text
            
            # Always use RAG - never switch it off
            try:
                # Try streaming first for immediate feedback
                response_en = ""
                stream_gen = openai_service.generate_response_stream(
                    prompt=f"Patient question: {prompt_text}",
                    max_tokens=200,  # Updated to 200 tokens as requested
                    temperature=0.2,  # Updated to 0.2 as requested
                    top_p=0.9,
                    request_id=request_id,
                    session_id=session_id,
                    use_rag=use_rag_flag,
                    user_language="en",
                    system_prompt=dynamic_system_prompt
                )
                
                # Collect all tokens from generator
                for token in stream_gen:
                    response_en += token
                    
            except Exception as e:
                # Fallback to non-streaming if streaming fails
                logger.warning(f"Streaming failed for non-English, using fallback: {e}")
                response_en = openai_service.generate_response(
                    prompt=f"Patient question: {prompt_text}",
                    max_tokens=200,  # Updated to 200 tokens as requested
                    temperature=0.2,  # Updated to 0.2 as requested
                    top_p=0.9,
                    request_id=request_id,
                    session_id=session_id,
                    use_rag=use_rag_flag,
                    user_language="en",
                    system_prompt=dynamic_system_prompt
                )
            
            # ULTRA-FAST async translation back to target language
            response = await sarvam_service.translation_service.text_translate_async(
                response_en, source_lang="en", target_lang=lang, request_id=request_id, session_id=session_id
            ) or response_en

        # Ensure DB session for this conversation (optional)
        try:
            if consultation_id and not session_db_id:
                logger.info(f"conversation_text: Creating DB session for consultation_id={consultation_id}")
                session_db_id = await get_or_create_session(db, consultation_id=int(consultation_id), session_type="text")
                logger.info(f"conversation_text: Created session_db_id={session_db_id}")
            else:
                logger.info(f"conversation_text: No DB session created - consultation_id={consultation_id}, session_db_id={session_db_id}")
        except Exception as e:
            logger.warning(f"conversation_text: get_or_create_session failed: {e}")
            import traceback
            logger.warning(f"conversation_text: get_or_create_session traceback: {traceback.format_exc()}")
        
        # Calculate total route latency
        total_latency_ms = int((time.time() - start_time) * 1000)
        
        logger.info("conversation_text: ok")
        
        # OPTIMIZATION 4: Non-blocking async logging (fire and forget - no polling)
        if session_db_id and consultation_id:
            # Create tasks with proper error handling to prevent API hangs
            try:
                # Log messages asynchronously with timeout protection
                message_task = asyncio.create_task(
                    asyncio.wait_for(
                        log_messages_async(
                            session_db_id, text, response, total_latency_ms // 2, total_latency_ms // 2
                        ),
                        timeout=30.0  # 30 second timeout to prevent hangs
                    )
                )
                
                # Log API usage asynchronously with timeout protection
                api_task = asyncio.create_task(
                    asyncio.wait_for(
                        log_api_usage_async(
                            consultation_id, session_db_id, text, response, 
                            total_latency_ms, lang, use_rag_flag
                        ),
                        timeout=30.0  # 30 second timeout to prevent hangs
                    )
                )
                
                # Add done callbacks to handle completion/errors without blocking
                message_task.add_done_callback(lambda t: logger.debug(f"Message logging task completed for session {session_db_id}"))
                api_task.add_done_callback(lambda t: logger.debug(f"API logging task completed for session {session_db_id}"))
                
                logger.info(f"✅ Non-blocking async logging initiated for session {session_db_id}")
                
            except Exception as e:
                logger.warning(f"Failed to initiate async logging for session {session_db_id}: {e}")
                # Continue without logging - don't block the response
        
        # Do not auto-close here; close on explicit end/clear-session
        return {
            "status": "success", 
            "final_response": response,
            "consultation_id": consultation_id,  # Return for frontend to use in subsequent requests
            "session_db_id": session_db_id,  # Return for frontend to use in subsequent requests
            "metrics": {
                "request_id": request_id,
                "session_id": session_id,
                "latency_ms": total_latency_ms
            }
        }
    except Exception as e:
        logger.error(f"Conversation text error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversation/speech")
async def conversation_speech(
    audio_file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    provider: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    streaming: Optional[str] = Form(None),
    use_rag: Optional[str] = Form(None),
    multilingual: Optional[str] = Form(None),
    consultation_id: Optional[int] = Form(None),
    session_db_id: Optional[int] = Form(None),
    caller: Dict[str, Any] = Depends(require_permissions(["conversation.speech"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    request_id = f"req-{int(time.time()*1000)}"
    # Use provided session_id or create a new one
    if not session_id:
        session_id = f"session-{int(time.time())}"
    start_time = time.time()
    
    try:
        logger.info(f"conversation_speech: filename={audio_file.filename} lang={language} provider={provider} request_id={request_id}")
        raw = await audio_file.read()
        
        # Validate audio data
        if len(raw) < 50:
            raise HTTPException(status_code=400, detail="Audio data too short")
        
        is_webm = audio_file.filename.endswith(".webm") if audio_file.filename else False
        
        if is_webm:
            try:
                wav_bytes = webm_to_wav_bytes(raw)
            except ValueError as e:
                if streaming and streaming.lower() == "true":
                    logger.warning(f"WebM chunk conversion failed, trying raw data: {e}")
                    # For streaming chunks, try using raw data if WebM conversion fails
                    wav_bytes = raw
                else:
                    logger.error(f"WebM conversion failed: {e}")
                    raise HTTPException(status_code=400, detail=f"Invalid WebM audio data: {str(e)}")
        else:
            wav_bytes = raw
        
        # STT with integrated analytics - provider-driven selection
        stt_start = time.time()
        lang = (language or "en").split("-")[0].lower()
        multilingual_enabled = multilingual and multilingual.lower() in ['true', '1', 'yes']
        provider_lower = (provider or "").lower()
        
        # Track which provider is actually used for logging
        actual_stt_provider = None
        
        logger.info(f"🔍 STT Provider Selection: provider_lower='{provider_lower}', language='{language}'")
        
        if provider_lower == "deepgram-nova3" or (provider_lower == "deepgram" and language == "multi"):
            # Use Deepgram Nova 3 with multilingual support
            lang_param = "multi" if language == "multi" else lang
            transcribed_text = deepgram_service.stt(wav_bytes, language=lang_param, request_id=request_id, session_id=session_id, multilingual=True)
            if (not transcribed_text) and is_webm:
                logger.info("Deepgram Nova 3 WAV path empty, retrying with audio/webm;codecs=opus")
                stt_start = time.time()
                transcribed_text = deepgram_service.stt_auto(raw, content_type="audio/webm;codecs=opus", language=lang_param, multilingual=True)
            logger.info("STT provider=deepgram-nova3")
            actual_stt_provider = "deepgram"
        elif provider_lower == "deepgram":
            # Explicitly selected Deepgram
            lang_short = (language or "en").split("-")[0]
            transcribed_text = deepgram_service.stt(wav_bytes, language=lang_short, request_id=request_id, session_id=session_id, multilingual=multilingual_enabled)
            if (not transcribed_text) and is_webm:
                logger.info("Deepgram WAV path empty, retrying with audio/webm;codecs=opus")
                stt_start = time.time()
                transcribed_text = deepgram_service.stt_auto(raw, content_type="audio/webm;codecs=opus", language=lang_short, multilingual=multilingual_enabled)
            logger.info("STT provider=deepgram")
            actual_stt_provider = "deepgram"
        else:
            # Sarvam streaming STT with integrated analytics
            transcribed_text = await sarvam_service.speech_to_text_streaming(
                audio_bytes=wav_bytes,
                language_code=language or "hi-IN",
                silence_timeout=3.0,
                encoding="audio/wav",
                sample_rate=16000,
                request_id=request_id,
                session_id=session_id
            )
            logger.info("STT provider=sarvam")
            actual_stt_provider = "sarvam"
        
        logger.info(f"🔍 STT Provider Used: actual_stt_provider='{actual_stt_provider}', transcript='{transcribed_text}'")
        stt_latency_ms = int((time.time() - stt_start) * 1000)
        logger.info(f"🔍 STT Completed: provider={actual_stt_provider}, latency={stt_latency_ms}ms, transcript_len={len(transcribed_text or '')}")

        # Ensure DB session for this conversation
        try:
            if consultation_id and not session_db_id:
                logger.info(f"conversation_speech: Creating DB session for consultation_id={consultation_id}")
                session_db_id = await get_or_create_session(db, consultation_id=int(consultation_id), session_type="speech")
                logger.info(f"conversation_speech: Created session_db_id={session_db_id}")
            else:
                logger.info(f"conversation_speech: Using existing session - consultation_id={consultation_id}, session_db_id={session_db_id}")
        except Exception as e:
            logger.warning(f"conversation_speech: get_or_create_session failed: {e}")
            import traceback
            logger.warning(f"conversation_speech: get_or_create_session traceback: {traceback.format_exc()}")

        # OPTIMIZATION 1: Get consultation and system prompt with caching
        dynamic_system_prompt = None
        consultation = None
        
        if consultation_id:
            try:
                from service.consultation_service import get_consultation_details
                consultation = await get_consultation_details(db, consultation_id=consultation_id)
                if consultation:
                    # Use cached system prompt for faster response
                    dynamic_system_prompt = await system_prompt_cache.get_system_prompt(
                        db, consultation.doctor_id, consultation_id
                    )
                    logger.info(f"✅ Using cached system prompt for Dr. ID {consultation.doctor_id}")
            except Exception as e:
                logger.warning(f"⚠️ Could not get cached system prompt: {e}")

        # Pipeline: Language-based STT routing and processing
        lang = (language or "en").split("-")[0].lower()
        
        # Decide RAG usage for this utterance (post-transcription)
        use_rag_flag = True
        if use_rag is not None:
            use_rag_flag = str(use_rag).lower() != "false"

        if lang == "en":
            # OPTIMIZATION 2: Optimized parameters for faster response
            final_response = openai_service.generate_response(
                prompt=f"Patient said: {transcribed_text}",
                max_tokens=180,  # Reduced for faster generation
                temperature=0.1,  # More deterministic = faster
                top_p=0.8,
                request_id=request_id,
                session_id=session_id,
                use_rag=(False if _is_trivial_utterance(transcribed_text) else use_rag_flag),
                user_language="en",
                system_prompt=dynamic_system_prompt,
                use_cache=True  # Enable response caching
            )
            input_en = transcribed_text
        else:
            # Non-English: ULTRA-FAST async translation -> ChatGPT (RAG) -> async translate back
            input_en = await sarvam_service.translation_service.text_translate_async(
                transcribed_text, source_lang=lang, target_lang="en", request_id=request_id, session_id=session_id
            ) or transcribed_text
            
            # Re-check triviality on normalized English
            rag_for_speech = (False if _is_trivial_utterance(input_en) else use_rag_flag)
            use_rag_flag = rag_for_speech  # Update the flag for logging

            final_response_en = openai_service.generate_response(
                prompt=f"Patient said: {input_en}",
                max_tokens=180,  # Reduced for faster generation
                temperature=0.1,  # More deterministic = faster
                top_p=0.8,
                request_id=request_id,
                session_id=session_id,
                use_rag=rag_for_speech,
                user_language="en",
                system_prompt=dynamic_system_prompt
            )
            
            # ULTRA-FAST async translation back to target language
            final_response = await sarvam_service.translation_service.text_translate_async(
                final_response_en, source_lang="en", target_lang=lang, request_id=request_id, session_id=session_id
            ) or final_response_en

        # DB logging removed
        
        # Calculate total route latency
        total_latency_ms = int((time.time() - start_time) * 1000)
        
        # OPTIMIZATION 4: Non-blocking async logging (fire and forget - no polling)
        if session_db_id and consultation_id:
            # Create tasks with proper error handling to prevent API hangs
            try:
                # Log messages asynchronously with timeout protection
                message_task = asyncio.create_task(
                    asyncio.wait_for(
                        log_messages_async(
                            session_db_id, transcribed_text, final_response, 
                            stt_latency_ms, (total_latency_ms - stt_latency_ms)
                        ),
                        timeout=30.0  # 30 second timeout to prevent hangs
                    )
                )
                
                # Log speech API usage asynchronously with timeout protection
                api_task = asyncio.create_task(
                    asyncio.wait_for(
                        log_speech_apis_async(
                            consultation_id, session_db_id, actual_stt_provider,
                            raw, transcribed_text, final_response, stt_latency_ms,
                            total_latency_ms, lang, use_rag_flag
                        ),
                        timeout=30.0  # 30 second timeout to prevent hangs
                    )
                )
                
                # Add done callbacks to handle completion/errors without blocking
                message_task.add_done_callback(lambda t: logger.debug(f"Speech message logging task completed for session {session_db_id}"))
                api_task.add_done_callback(lambda t: logger.debug(f"Speech API logging task completed for session {session_db_id}"))
                
                logger.info(f"✅ Non-blocking async speech logging initiated for session {session_db_id}")
                
            except Exception as e:
                logger.warning(f"Failed to initiate async speech logging for session {session_db_id}: {e}")
                # Continue without logging - don't block the response
        
        # DO NOT auto-close session here - let it stay open for ongoing conversation
        # Session will be closed when user explicitly clicks "End Conversation" or "New Session"
        
        # Handle streaming mode - only return transcription, no AI response
        if streaming and streaming.lower() == "true":
            logger.info(f"conversation_speech: streaming mode - stt only, transcript: '{transcribed_text}'")
            return {
                "status": "success", 
                "transcribed_text": transcribed_text,
                "streaming": True,
                "metrics": {
                    "request_id": request_id,
                    "session_id": session_id,
                    "latency_ms": total_latency_ms
                }
            }
        else:
            # Normal mode - return both transcription and AI response
            logger.info("conversation_speech: normal mode - stt + llm")
            return {
                "status": "success", 
                "transcribed_text": transcribed_text, 
                "final_response": final_response,
                "consultation_id": consultation_id,  # Return for frontend to use in subsequent requests
                "session_db_id": session_db_id,  # Return for frontend to use in subsequent requests
                "metrics": {
                    "request_id": request_id,
                    "session_id": session_id,
                    "latency_ms": total_latency_ms
                }
            }
    except Exception as e:
        logger.error(f"Conversation speech error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversation/cancel")
async def conversation_cancel():
    """Cancel conversation - Non-critical endpoint, no auth required"""
    return {"status": "cancelled"}


@router.post("/conversation/clear-session")
async def clear_session(
    session_id: str = Form(...),
    consultation_id: Optional[int] = Form(None),
    session_db_id: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Clear conversation history and optionally close DB session for the consultation - Non-critical endpoint, no auth required"""
    try:
        # Clear in-memory/chat cache
        openai_service.clear_session(session_id)
        logger.info(f"Session cleared: {session_id}")

        # Close DB session if provided
        if session_db_id:
            try:
                from service.consultation_service import close_session
                await close_session(db, session_id=int(session_db_id), status="completed")
                logger.info(f"✅ Closed DB session_id={session_db_id} for consultation_id={consultation_id}")
            except Exception as e:
                logger.warning(f"⚠️ Failed to close DB session {session_db_id}: {e}")

        return {"status": "success", "message": f"Session {session_id} cleared", "session_db_id": session_db_id}
    except Exception as e:
        logger.error(f"Error clearing session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversation/end-session")
async def end_session(
    request: dict,
    caller: Dict[str, Any] = Depends(require_permissions(["conversation.end"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    """End a consultation session and calculate total duration"""
    try:
        session_db_id = request.get("session_db_id")
        consultation_id = request.get("consultation_id")
        
        # If session_db_id is not provided, try to find the active session for this consultation
        if not session_db_id and consultation_id:
            try:
                from models.models import ConsultationSession
                from sqlalchemy import select
                
                # Find the active session for this consultation
                query = select(ConsultationSession).where(
                    ConsultationSession.consultation_id == int(consultation_id),
                    ConsultationSession.status == "active"
                )
                result = await db.execute(query)
                active_session = result.scalar_one_or_none()
                
                if active_session:
                    session_db_id = active_session.session_id
                    logger.info(f"Found active session {session_db_id} for consultation {consultation_id}")
                else:
                    logger.warning(f"No active session found for consultation {consultation_id}")
                    return {
                        "status": "success", 
                        "message": "No active session to end",
                        "session_id": None,
                        "consultation_id": consultation_id
                    }
            except Exception as e:
                logger.error(f"Error finding active session for consultation {consultation_id}: {e}")
                return {
                    "status": "success", 
                    "message": "Session ended (no active session found)",
                    "session_id": None,
                    "consultation_id": consultation_id
                }
        elif not session_db_id:
            logger.warning("No session_db_id provided and no consultation_id to search")
            return {
                "status": "success", 
                "message": "Session ended (no session to close)",
                "session_id": None,
                "consultation_id": consultation_id
            }
        
        # Close the session using the existing service function
        if session_db_id:
            from service.consultation_service import close_session
            await close_session(db, session_id=int(session_db_id), status="completed")
            logger.info(f"Successfully ended session {session_db_id} for consultation {consultation_id}")
        else:
            logger.info(f"Session ended for consultation {consultation_id} (no session to close)")
        
        return {
            "status": "success", 
            "message": "Session ended successfully",
            "session_id": session_db_id,
            "consultation_id": consultation_id
        }
        
    except Exception as e:
        logger.error(f"Error ending session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversation/clear-all-sessions")
async def clear_all_sessions():
    """Clear all conversation sessions - Non-critical endpoint, no auth required"""
    try:
        openai_service.clear_all_sessions()
        logger.info("All sessions cleared")
        return {"status": "success", "message": "All sessions cleared"}
    except Exception as e:
        logger.error(f"Error clearing all sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversation/session-info")
async def get_session_info():
    """Get information about current sessions - Non-critical endpoint, no auth required"""
    try:
        session_info = openai_service.get_session_info()
        return {"status": "success", "data": session_info}
    except Exception as e:
        logger.error(f"Error getting session info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversation/cleanup-sessions")
async def cleanup_sessions():
    """Manually trigger cleanup of expired sessions - Non-critical endpoint, no auth required"""
    try:
        cleaned_count = openai_service.cleanup_expired_sessions()
        logger.info(f"Cleaned up {cleaned_count} expired sessions")
        return {"status": "success", "message": f"Cleaned up {cleaned_count} expired sessions"}
    except Exception as e:
        logger.error(f"Error cleaning up sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversation/session-conversation/{session_id}")
async def get_session_conversation(session_id: str):
    """Get conversation history for a specific session - Non-critical endpoint, no auth required"""
    try:
        conversation = openai_service.get_session_conversation(session_id)
        return {"status": "success", "data": {"session_id": session_id, "conversation": conversation}}
    except Exception as e:
        logger.error(f"Error getting session conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversation/session-test", response_class=HTMLResponse)
async def session_test_page():
    """Serve the session memory test page"""
    try:
        with open("templates/session_test.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        logger.error(f"Error serving session test page: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversation/session-consistency-test", response_class=HTMLResponse)
async def session_consistency_test_page():
    """Serve the session consistency test page"""
    try:
        with open("templates/session_consistency_test.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        logger.error(f"Error serving session consistency test page: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@router.get("/conversation", response_class=HTMLResponse)
async def conversation_page():
    """Serve the conversation page"""
    try:
        with open("templates/conversation.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        logger.error(f"Error serving conversation page: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/thank-you-test")
async def thank_you_test():
    """Test route to verify the router is working"""
    return {"message": "Thank you route is working", "status": "success"}

@router.get("/thank-you-debug")
async def thank_you_debug():
    """Debug route to check what's happening"""
    import os
    file_path = os.path.join(os.getcwd(), "templates", "thank_you.html")
    return {
        "message": "Debug info",
        "current_dir": os.getcwd(),
        "file_path": file_path,
        "file_exists": os.path.exists(file_path),
        "templates_dir": os.path.exists("templates"),
        "thank_you_exists": os.path.exists("templates/thank_you.html")
    }

@router.get("/thank-you", response_class=HTMLResponse)
async def thank_you_page():
    """Serve the thank you page after consultation completion"""
    try:
        import os
        file_path = os.path.join(os.getcwd(), "templates", "thank_you.html")
        logger.info(f"Looking for thank you page at: {file_path}")
        logger.info(f"File exists: {os.path.exists(file_path)}")
        
        with open("templates/thank_you.html", "r", encoding="utf-8") as f:
            content = f.read()
            logger.info(f"Successfully read thank you page, content length: {len(content)}")
            return HTMLResponse(content=content)
    except Exception as e:
        logger.error(f"Error serving thank you page: {e}")
        raise HTTPException(status_code=500, detail=str(e))


 


@router.post("/tts/stream")
async def tts_stream(
    text: str = Form(...), 
    language: str = Form("hi-IN"), 
    provider: str = Form("sarvam"),
    consultation_id: Optional[int] = Form(None),
    session_id: Optional[str] = Form(None),
    session_db_id: Optional[int] = Form(None),
    caller: Dict[str, Any] = Depends(require_permissions(["tts.stream"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    request_id = f"req-{int(time.time()*1000)}"
    start_time = time.time()
    
    # Debug logging to see what parameters are received
    logger.info(f"🔍 TTS DEBUG: consultation_id={consultation_id} (type: {type(consultation_id)}), session_id={session_id} (type: {type(session_id)}), session_db_id={session_db_id} (type: {type(session_db_id)})")
    
    # Use provider as selected by user (no auto-switching logic)
    provider_lower = (provider or "deepgram").lower()  # Default to deepgram if not specified
    lang_short = (language or "en").split("-")[0].lower()

    async def generator():
        tts_start = time.time()
        audio_chunks = []
        try:
            print(f"TTS REQUEST: {text}")
            logger.info(f"tts_stream: provider={provider_lower} lang={language} text_len={len(text)} request_id={request_id}")
            if provider_lower == "deepgram" or provider_lower == "deepgram-nova3":
                logger.info("🎤 TTS provider=deepgram (production-grade streaming)")
                
                # Select Deepgram voice per language (env override supported)
                dg_voice = os.getenv("DEEPGRAM_TTS_VOICE_EN", "aura-asteria-en")
                lang_lower_for_tts = (language or "").lower()
                if lang_lower_for_tts in ["hi", "hi-in", "hin", "multi", "auto", "und", ""]:
                    dg_voice = os.getenv("DEEPGRAM_TTS_VOICE_HI", dg_voice)
                
                # Production-grade streaming with optimized buffering
                chunk_count = 0
                first_chunk_time = None
                
                async for chunk in deepgram_service.tts_streaming(
                    text=text, 
                    voice=dg_voice, 
                    encoding="mp3",
                    request_id=request_id
                ):
                    if not chunk:
                        continue
                    
                    chunk_count += 1
                    audio_chunks.append(chunk)
                    
                    # Track first chunk latency (TTFB)
                    if first_chunk_time is None:
                        first_chunk_time = time.time()
                        ttfb = int((first_chunk_time - tts_start) * 1000)
                        logger.info(f"⚡ Deepgram First Chunk: {ttfb}ms, size: {len(chunk)} bytes")
                    
                    # Immediate yield for low latency
                    yield chunk
                
                logger.info(f"✅ Deepgram TTS: {chunk_count} chunks streamed")
                
                # Log TTS through service layer
                try:
                    tts_duration = int((time.time() - tts_start) * 1000)
                    if consultation_id and session_db_id:
                        from service.analytics_service import log_deepgram_tts
                        from service.consultation_service import get_consultation_details
                        
                        # Get consultation details using service layer
                        consultation = await get_consultation_details(db, consultation_id=consultation_id)
                        
                        if consultation:
                            await log_deepgram_tts(
                                db=db,
                                text_length=len(text),
                                audio_size=sum(len(c) for c in audio_chunks),
                                response_time_ms=tts_duration,
                                session_id=int(session_db_id),
                                doctor_id=consultation.doctor_id,
                                patient_id=consultation.patient_id,
                                hospital_id=consultation.hospital_id
                            )
                            logger.info(f"✅ Deepgram TTS logged for session {session_db_id}")
                except Exception as e:
                    logger.error(f"❌ TTS logging failed: {e}")
            else:
                # Use Sarvam TTS streaming with low-latency WAV micro-segments built from PCM chunks
                try:
                    import struct
                    # Helper to wrap raw PCM16 mono data into a minimal WAV file
                    def _wrap_pcm16_to_wav(pcm_bytes: bytes, sample_rate: int = 16000) -> bytes:
                        try:
                            num_channels = 1
                            bits_per_sample = 16
                            data_size = len(pcm_bytes)
                            byte_rate = sample_rate * num_channels * bits_per_sample // 8
                            block_align = num_channels * bits_per_sample // 8
                            riff_chunk_size = 36 + data_size
                            wav_header = (
                                b'RIFF' + struct.pack('<I', riff_chunk_size) + b'WAVE' +
                                b'fmt ' + struct.pack('<I', 16) + struct.pack('<H', 1) +
                                struct.pack('<H', num_channels) + struct.pack('<I', sample_rate) +
                                struct.pack('<I', byte_rate) + struct.pack('<H', block_align) + struct.pack('<H', bits_per_sample) +
                                b'data' + struct.pack('<I', data_size)
                            )
                            return wav_header + pcm_bytes
                        except Exception:
                            return pcm_bytes

                    # Optimized for voice agent: immediate first chunk + complete streaming
                    TARGET_FLUSH_BYTES = 2048   # ~0.06s of audio - good balance
                    MAX_COALESCE_INTERVAL = 0.02  # 20ms max delay for immediate streaming
                    FIRST_CHUNK_BYTES = 1024  # Small first chunk for fast start
                    MAX_AUDIO_TIME = 60.0  # Allow up to 30 seconds for complete audio

                    coalesce = bytearray()
                    last_flush = time.time()
                    total_pcm = 0
                    chunk_count = 0
                    stream_start_time = time.time()

                    # Process all audio chunks from the streaming service with timeout
                    chunk_iterator = sarvam_service.text_to_speech_streaming_chunks(
                        text=text,
                        language=language,
                        speaker="karun"
                    )
                    
                    try:
                        # Stream audio chunks immediately for low latency, but ensure complete delivery
                        start_time = time.time()
                        async for audio_chunk in chunk_iterator:
                            # Check for timeout manually
                            if time.time() - start_time > MAX_AUDIO_TIME:
                                logger.warning(f"⏱️ Sarvam TTS streaming timeout after {MAX_AUDIO_TIME}s")
                                break
                                
                            if not audio_chunk:
                                continue
                            coalesce.extend(audio_chunk)
                            total_pcm += len(audio_chunk)
                            now = time.time()
                            
                            # Optimized chunk delivery for smoother playback
                            min_chunk_size = FIRST_CHUNK_BYTES if chunk_count == 0 else TARGET_FLUSH_BYTES
                            
                            if len(coalesce) >= min_chunk_size or (now - last_flush) >= MAX_COALESCE_INTERVAL:
                                wav_chunk = _wrap_pcm16_to_wav(bytes(coalesce), sample_rate=16000)
                                coalesce.clear()
                                last_flush = now
                                chunk_count += 1
                                audio_chunks.append(wav_chunk)
                                
                                # Track first chunk latency
                                if chunk_count == 1:
                                    first_chunk_latency = int((time.time() - tts_start) * 1000)
                                    logger.info(f"⚡ Sarvam TTS First Chunk: {first_chunk_latency}ms, size: {len(wav_chunk)} bytes")
                                
                                # Frame each WAV segment to preserve boundaries
                                seg_len = len(wav_chunk)
                                header = b'WAVC' + struct.pack('>I', seg_len)
                                yield header + wav_chunk  # Send as single chunk
                                
                                # Log progress for debugging
                                if chunk_count % 5 == 0:  # Log every 5 chunks
                                    logger.info(f"🔄 Sarvam TTS: Processed {chunk_count} chunks, {total_pcm} bytes so far")
                    
                    except Exception as e:
                        logger.error(f"❌ Sarvam TTS streaming error: {e}")
                        raise e
                    
                    finally:
                        # Ensure we flush any remaining buffer
                        if coalesce:
                            wav_chunk = _wrap_pcm16_to_wav(bytes(coalesce), sample_rate=16000)
                            audio_chunks.append(wav_chunk)
                            chunk_count += 1
                            header = b'WAVC' + struct.pack('>I', len(wav_chunk))
                            yield header + wav_chunk
                            logger.info(f"🎵 Sarvam TTS: Final chunk {chunk_count}: {len(wav_chunk)} bytes")
                        
                        # TTS streaming completed successfully

                    # Comprehensive Sarvam TTS logging
                    total_size = sum(len(c) for c in audio_chunks)
                    logger.info(f"Sarvam TTS streaming completed: {chunk_count} wav-segments, {total_size} bytes")
                    
                    try:
                        tts_duration = int((time.time() - tts_start) * 1000)
                        if consultation_id and session_db_id:
                            from service.analytics_service import log_sarvam_tts
                            from service.consultation_service import get_consultation_details
                            
                            # Get consultation details using service layer
                            consultation = await get_consultation_details(db, consultation_id=consultation_id)
                            
                            if consultation:
                                await log_sarvam_tts(
                                    db=db,
                                    text_length=len(text),
                                    audio_size=total_size,
                                    response_time_ms=tts_duration,
                                    session_id=int(session_db_id),
                                    doctor_id=consultation.doctor_id,
                                    patient_id=consultation.patient_id,
                                    hospital_id=consultation.hospital_id
                                )
                                logger.info(f"✅ Sarvam TTS logged for session {session_db_id}")
                    except Exception as e:
                        logger.error(f"❌ Sarvam TTS logging failed: {e}")
                    
                except Exception as e:
                    logger.error(f"Sarvam TTS streaming error: {e}")
                    
                    # Only fallback if we haven't received any audio chunks yet
                    if len(audio_chunks) == 0:
                        logger.info("No audio chunks received, attempting fallback to non-streaming method")
                        try:
                            audio_bytes = await sarvam_service.text_to_speech_streaming(
                                text=text,
                                language=language,
                                speaker="karun",
                                request_id=request_id,
                                session_id=session_id
                            )
                            
                            if audio_bytes:
                                # Fallback to non-streaming but still emit promptly in medium chunks
                                wav_bytes = _wrap_pcm16_to_wav(audio_bytes, sample_rate=16000)
                                # Frame fallback output as WAVC segments to keep client parser consistent
                                import struct as _struct
                                chunk_size = 16384
                                for i in range(0, len(wav_bytes), chunk_size):
                                    chunk = wav_bytes[i:i + chunk_size]
                                    audio_chunks.append(chunk)
                                    header = b'WAVC' + _struct.pack('>I', len(chunk))
                                    yield header + chunk
                                logger.info(f"Sarvam TTS fallback completed: {len(audio_bytes)} bytes")
                            else:
                                logger.error("Sarvam TTS fallback also failed - no audio generated")
                        except Exception as fallback_error:
                            logger.error(f"Sarvam TTS fallback error: {fallback_error}")
                    else:
                        logger.info(f"Sarvam TTS streaming partially successful: {len(audio_chunks)} chunks received before error")
        except Exception as e:
            logger.error(f"TTS stream error: {e}")
            try:
                audio = deepgram_service.tts(text, voice="aura-kathleen-en", request_id=request_id, session_id=session_id)
                if audio:
                    yield audio
            except Exception as e2:
                logger.error(f"TTS fallback error: {e2}")
                return
    
    media_type = "audio/mpeg" if provider_lower in ["deepgram", "deepgram-nova3"] else "audio/wav"
    
    # Add headers to ensure proper streaming behavior
    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Transfer-Encoding": "chunked",
        "X-Accel-Buffering": "no"  # Disable nginx buffering if present
    }
    
    return StreamingResponse(generator(), media_type=media_type, headers=headers)


# ---------------------------
# Transcript Endpoints
# ---------------------------

@router.post("/conversation/save-transcript")
async def save_conversation_transcript(
    consultation_id: int = Form(...),
    session_db_id: Optional[int] = Form(None),
    transcript_text: Optional[str] = Form(None),
    file_url: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Save final conversation transcript to consultation_transcripts table"""
    try:
        # If transcript_text not provided, generate from session messages
        if not transcript_text and session_db_id:
            transcript_text = await get_session_transcript_text(db, session_id=session_db_id)
        
        if not transcript_text:
            raise HTTPException(status_code=400, detail="No transcript text available")
        
        # Save to consultation_transcripts table
        transcript_id = await save_transcript(
            db,
            consultation_id=consultation_id,
            transcript_text=transcript_text,
            file_url=file_url
        )
        
        
        logger.info(f"Transcript saved: consultation_id={consultation_id}, transcript_id={transcript_id}")
        return {
            "status": "success",
            "transcript_id": transcript_id,
            "message": "Transcript saved successfully"
        }
    except Exception as e:
        logger.error(f"Error saving transcript: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversation/transcript/{session_id}")
async def get_transcript(session_id: str):
    """Return structured transcript for a session, combining DB I/O logs and provider memory if available."""
    try:
        # DB transcript retrieval removed
        db_rows = []

        # Gather in-memory conversation from provider (best-effort)
        provider_conv = []
        try:
            conv = openai_service.get_session_conversation(session_id)
            # Expecting a list of messages like {role, content}
            if isinstance(conv, list):
                provider_conv = conv
        except Exception:
            pass

        return JSONResponse(
            content={
                "status": "success",
                "data": {
                    "session_id": session_id,
                    "db_logs": db_rows,
                    "provider_conversation": provider_conv
                }
            }
        )
    except Exception as e:
        logger.error(f"Error building transcript for {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversation/transcript/download/{session_id}")
async def download_transcript(session_id: str):
    """Return a plaintext Medical Transcript for a session as a downloadable file."""
    try:
        # DB transcript retrieval removed; using provider memory only
        lines = []

        # Fallback or enrichment from provider memory
        try:
            conv = openai_service.get_session_conversation(session_id)
            if isinstance(conv, list) and conv:
                lines.append("")
                lines.append("-- Provider Conversation Memory --")
                for m in conv:
                    role = m.get("role", "assistant")
                    speaker = "Patient" if role == "user" else "Doctor"
                    content = m.get("content", "")
                    lines.append(f"{speaker}: {content}")
        except Exception:
            pass

        header = [
            "Medical Transcript",
            f"Session: {session_id}",
            "",
        ]
        body = "\n".join(lines) if lines else "No conversation found for this session."
        text = "\n".join(header) + body

        filename = f"medical_transcript_{session_id}.txt"
        return PlainTextResponse(content=text, media_type="text/plain", headers={
            "Content-Disposition": f"attachment; filename={filename}"
        })
    except Exception as e:
        logger.error(f"Error downloading transcript for {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))