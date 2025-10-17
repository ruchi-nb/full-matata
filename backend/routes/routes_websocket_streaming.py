from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.responses import HTMLResponse
import asyncio
import base64
import json
import logging
import time
from typing import Dict, List, Optional
from urllib.parse import parse_qs

from integrations.unified_services import sarvam_service, deepgram_service, openai_service
from database.database import AsyncSessionLocal
from service.consultation_service import open_session
from service.analytics_service import (
    log_deepgram_stt, log_sarvam_stt, log_openai_chat,
    log_sarvam_translation, log_rag_retrieval
)
from utils.utils import decode_token
from database.redis import token_in_blocklist

logger = logging.getLogger(__name__)

async def translate_with_timeout(text: str, source_lang: str, target_lang: str, 
                                request_id: str = None, session_id: str = None, 
                                timeout: float = 3.0) -> str:
    """Translation wrapper with timeout to prevent hanging"""
    try:
        result = await asyncio.wait_for(
            sarvam_service.translation_service.text_translate_async(
                text, source_lang, target_lang, request_id, session_id
            ),
            timeout=timeout
        )
        return result or text
    except asyncio.TimeoutError:
        logger.warning(f"Translation timeout after {timeout}s, returning original text")
        return text
    except Exception as e:
        logger.error(f"Translation error: {e}, returning original text")
        return text
router = APIRouter()

async def authenticate_websocket(websocket: WebSocket, token: Optional[str] = None) -> Dict[str, any]:
    """Authenticate WebSocket connection using JWT token"""
    if not token:
        await websocket.close(code=1008, reason="Missing authentication token")
        raise HTTPException(status_code=401, detail="Missing authentication token")
    
    # Decode and validate token
    token_data = decode_token(token)
    if token_data is None:
        await websocket.close(code=1008, reason="Invalid or expired token")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Check if token is revoked
    jti = token_data.get("jti")
    if jti and await token_in_blocklist(jti):
        await websocket.close(code=1008, reason="Token has been revoked")
        raise HTTPException(status_code=401, detail="Token has been revoked")
    
    # Verify it's an access token (not a refresh token)
    if token_data.get("is_refresh", False):
        await websocket.close(code=1008, reason="Access token required")
        raise HTTPException(status_code=401, detail="Access token required")
    
    user_payload = token_data.get("user")
    if not user_payload or not isinstance(user_payload, dict):
        await websocket.close(code=1008, reason="Invalid user data in token")
        raise HTTPException(status_code=401, detail="Invalid user data in token")
    
    return user_payload

def _map_to_deepgram_language(lang: str) -> str:
    """Map general or regional language codes to Deepgram expected codes.
    Defaults English to en-US when only 'en' is provided.
    """
    if not lang:
        return "en-US"
    # Already regional
    if '-' in lang:
        # For English, force en-US for maximum compatibility
        if lang.lower().startswith('en'):
            return 'en-US'
        return lang
    # Short codes
    short = lang.lower()
    if short.startswith('en'):
        return 'en-US'
    return short

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.session_data: Dict[WebSocket, dict] = {}
        # Maintain per-frontend-session Sarvam WS and tasks
        self.sarvam_ws_map: Dict[WebSocket, dict] = {}
        # Maintain per-frontend-session Deepgram buffering state
        self.deepgram_map: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.session_data[websocket] = {
            'session_id': f"ws-session-{int(time.time())}",
            'request_id': f"ws-{int(time.time()*1000)}",
            'is_processing': False,
            'language': 'en-IN',
            'utterance_seq': 0,
            'final_sent_at': 0.0,
            'last_final_norm': '',
            'last_final_time': 0.0,
            # DB binding
            'db_session_id': None,
            'consultation_id': None
        }
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        # Do not auto-close DB session here; rely on explicit end/clear-session
        if websocket in self.session_data:
            del self.session_data[websocket]
        # Close Sarvam WS if present
        sarvam = self.sarvam_ws_map.pop(websocket, None)
        if sarvam:
            try:
                ws = sarvam.get('ws')
                if ws:
                    # Close asynchronously
                    asyncio.create_task(ws.close())
            except Exception:
                pass
        # Cleanup Deepgram buffer state
        dg = self.deepgram_map.pop(websocket, None)
        if dg:
            try:
                task = dg.get('debounce_task')
                if task and not task.done():
                    task.cancel()
            except Exception:
                pass
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            if websocket in self.active_connections and websocket.client_state.name == "CONNECTED":
                await websocket.send_text(json.dumps(message))
            else:
                logger.warning(f"Cannot send message - WebSocket not connected: {websocket.client_state.name}")
        except Exception as e:
            logger.error(f"Error sending message to WebSocket: {e}")
            # Remove disconnected WebSocket from active connections
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
            if websocket in self.session_data:
                del self.session_data[websocket]

    async def broadcast(self, message: dict):
        disconnected_connections = []
        for connection in self.active_connections:
            try:
                if connection.client_state.name == "CONNECTED":
                    await connection.send_text(json.dumps(message))
                else:
                    disconnected_connections.append(connection)
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket: {e}")
                disconnected_connections.append(connection)
        
        # Remove disconnected connections
        for connection in disconnected_connections:
            if connection in self.active_connections:
                self.active_connections.remove(connection)
            if connection in self.session_data:
                del self.session_data[connection]

manager = ConnectionManager()

async def handle_stop(websocket: WebSocket):
    """Stop all streaming for this websocket and clean up state."""
    try:
        # Cancel Sarvam streaming WS
        sarvam = manager.sarvam_ws_map.pop(websocket, None)
        if sarvam:
            try:
                ws = sarvam.get('ws')
                if ws:
                    await ws.close()
            except Exception:
                pass
        # Cancel Deepgram debounce task and clear buffer
        dg = manager.deepgram_map.get(websocket)
        if dg:
            try:
                task = dg.get('debounce_task')
                if task and not task.done():
                    task.cancel()
            except Exception:
                pass
            try:
                buf = dg.get('buffer')
                if isinstance(buf, bytearray):
                    buf.clear()
            except Exception:
                pass
        # Let client know processing stopped
        if websocket.client_state.name == "CONNECTED":
            await manager.send_personal_message({
                "type": "processing_state",
                "is_processing": False
            }, websocket)
    except Exception as e:
        logger.warning(f"Stop handling failed: {e}")

@router.websocket("/conversation/stream")
async def websocket_conversation(websocket: WebSocket, token: Optional[str] = Query(None)):
    """WebSocket endpoint for streaming conversation with JWT authentication"""
    try:
        # Authenticate the WebSocket connection
        user_data = await authenticate_websocket(websocket, token)
        logger.info(f"WebSocket authenticated for user: {user_data.get('username', 'unknown')}")
    except Exception as e:
        logger.error(f"WebSocket authentication failed: {e}")
        return
    
    await manager.connect(websocket)
    session_data = manager.session_data[websocket]
    session_data['authenticated_user'] = user_data
    
    try:
        # Send initial connection confirmation
        await manager.send_personal_message({
            "type": "connection_established",
            "message": "WebSocket streaming conversation ready",
            "session_id": session_data['session_id']
        }, websocket)
        
        while True:
            try:
                # Check if WebSocket is still connected before receiving
                if websocket.client_state.name != "CONNECTED":
                    logger.warning("WebSocket not connected, breaking loop")
                    break
                
                # Receive message from client with timeout
                try:
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                except asyncio.TimeoutError:
                    # Send ping to check connection
                    await manager.send_personal_message({
                        "type": "ping"
                    }, websocket)
                    continue
                
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    # Respond to ping with pong
                    await manager.send_personal_message({
                        "type": "pong"
                    }, websocket)
                    continue
                
                elif message.get("type") == "init":
                    # Bind incoming WS to existing app session and preferences
                    try:
                        sid = message.get('session_id') or message.get('sessionId')
                        lang = message.get('language') or session_data.get('language')
                        prov = (message.get('provider') or 'sarvam').lower()
                        # Optional: client can provide an existing consultation_id to persist
                        cid = message.get('consultation_id') or message.get('consultationId')
                        # Multilingual support for Deepgram
                        multilingual = message.get('multilingual', False)
                        if sid:
                            session_data['session_id'] = sid
                        if lang:
                            session_data['language'] = lang
                        session_data['provider'] = prov
                        session_data['multilingual'] = multilingual
                        if cid:
                            try:
                                session_data['consultation_id'] = int(cid)
                            except Exception:
                                session_data['consultation_id'] = None
                        # Open a DB consultation session if consultation_id is provided
                        if session_data.get('consultation_id') and not session_data.get('db_session_id'):
                            try:
                                async with AsyncSessionLocal() as db:
                                    db_session_id = await open_session(db, consultation_id=int(session_data['consultation_id']), session_type="ws")
                                    session_data['db_session_id'] = int(db_session_id)
                            except Exception as e:
                                logger.warning(f"[WS:init] DB session open failed: {e}")
                        logger.info(f"[WS:init] provider={prov} language={session_data['language']} session_id={session_data['session_id']} db_session_id={session_data.get('db_session_id')} consultation_id={session_data.get('consultation_id')}")
                        await manager.send_personal_message({
                            "type": "connection_established",
                            "message": "WebSocket session bound",
                            "session_id": session_data['session_id'],
                            "db_session_id": session_data.get('db_session_id'),
                            "consultation_id": session_data.get('consultation_id')
                        }, websocket)
                    except Exception as e:
                        logger.warning(f"WS init handling failed: {e}")
                elif message.get("type") == "audio_data":
                    await handle_audio_data(websocket, message, session_data)
                elif message.get("type") == "audio_chunk":
                    await handle_audio_chunk(websocket, message, session_data)
                elif message.get("type") == "flush":
                    await handle_flush_signal(websocket, session_data)
                elif message.get("type") == "final_audio":
                    await handle_final_audio(websocket, message, session_data)
                elif message.get("type") == "stop":
                    await handle_stop(websocket)
                
                else:
                    logger.warning(f"Unknown message type: {message.get('type')}")
                    
            except WebSocketDisconnect:
                logger.info("WebSocket disconnected by client")
                break
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                # Only send error if WebSocket is still connected
                if websocket.client_state.name == "CONNECTED":
                    try:
                        await manager.send_personal_message({
                            "type": "error",
                            "message": f"Processing error: {str(e)}"
                        }, websocket)
                    except:
                        pass  # Don't try to send error if connection is broken
                break
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)

async def handle_audio_data(websocket: WebSocket, message: dict, session_data: dict):
    """Handle incoming audio data from WebSocket client"""
    try:
        if session_data['is_processing']:
            logger.warning("Already processing audio, ignoring new request")
            return
        
        session_data['is_processing'] = True
        
        # Notify client that processing has started
        await manager.send_personal_message({
            "type": "processing_state",
            "is_processing": True
        }, websocket)
        
        # Decode base64 audio data
        audio_base64 = message.get('audio', '')
        language = message.get('language', 'en-IN')
        provider = (message.get('provider') or 'sarvam').lower()
        
        if not audio_base64:
            raise ValueError("No audio data provided")
        
        audio_bytes = base64.b64decode(audio_base64)
        logger.info(f"[WS:audio_data] provider={provider} lang={language} size={len(audio_bytes)}B")
        
        # Validate audio size
        if len(audio_bytes) < 1000:
            raise ValueError("Audio data too short")
        
        start_time = time.time()

        # Branch STT provider
        if provider == 'deepgram' or provider == 'deepgram-nova3':
            dg_lang = _map_to_deepgram_language(language or 'en-US')
            # Convert to WAV and use Deepgram STT streaming
            try:
                from routes.routes_conversation import webm_to_wav_bytes
                wav_bytes = webm_to_wav_bytes(audio_bytes)
            except Exception as conv_e:
                logger.warning(f"[Deepgram STT] WebM->WAV conversion failed: {conv_e}")
                wav_bytes = audio_bytes
            logger.info(f"[Deepgram STT] processing final blob size={len(wav_bytes)}B lang={dg_lang}")
            multilingual_mode = provider == 'deepgram-nova3' or session_data.get('multilingual', False) or dg_lang == 'multi'
            transcribed_text = await deepgram_service.stt_streaming(
                 audio_bytes=wav_bytes,
                 language_code=dg_lang,
                 encoding="audio/wav",
                 sample_rate=16000,
                 request_id=session_data['request_id'],
                 session_id=session_data['session_id'],
                 multilingual=multilingual_mode
             )
        else:
            # Sarvam path expects WAV
            try:
                from routes.routes_conversation import webm_to_wav_bytes
                wav_bytes = webm_to_wav_bytes(audio_bytes)
            except Exception as e:
                logger.warning(f"WebM conversion failed, using raw data: {e}")
                wav_bytes = audio_bytes
            # Prefer session WS if available for low-latency flush-based finalization
            sarvam_entry = manager.sarvam_ws_map.get(websocket)
            if sarvam_entry and sarvam_entry.get('ws'):
                try:
                    await sarvam_entry['ws'].transcribe(
                        audio=base64.b64encode(wav_bytes).decode('utf-8'),
                        encoding="audio/wav",
                        sample_rate=16000
                    )
                    await sarvam_entry['ws'].flush()
                    # We'll assemble final from streaming events; return empty here
                    transcribed_text = ""
                except Exception as e:
                    logger.warning(f"[Sarvam STT] Session flush finalization failed, fallback single-shot: {e}")
                    transcribed_text = await sarvam_service.speech_to_text_streaming(
                        audio_bytes=wav_bytes,
                        language_code=language,
                        silence_timeout=3.0,
                        encoding="audio/wav",
                        sample_rate=16000,
                        request_id=session_data['request_id'],
                        session_id=session_data['session_id']
                    )
            else:
                transcribed_text = await sarvam_service.speech_to_text_streaming(
                    audio_bytes=wav_bytes,
                    language_code=language,
                    silence_timeout=3.0,
                    encoding="audio/wav",
                    sample_rate=16000,
                    request_id=session_data['request_id'],
                    session_id=session_data['session_id']
                )
        
        stt_latency = int((time.time() - start_time) * 1000)
        logger.info(f"STT completed in {stt_latency}ms: '{transcribed_text}'")
        
        if not transcribed_text or transcribed_text.strip().lower() in ['none', '']:
            # No meaningful speech detected
            await manager.send_personal_message({
                "type": "transcript",
                "transcript": "",
                "is_final": True
            }, websocket)
            
            await manager.send_personal_message({
                "type": "processing_state",
                "is_processing": False
            }, websocket)
            return
        
        # Deduplicate finals to avoid double backend processing (e.g., audio_data + final_audio)
        try:
            current_norm = (transcribed_text or '').strip().lower()
            last_norm = (session_data.get('last_final_norm') or '')
            last_time = float(session_data.get('last_final_time') or 0)
            if current_norm and last_norm and current_norm == last_norm and (time.time() - last_time) < 3.0:
                logger.info("[WS] Skipping duplicate final within 3s window (audio_data)")
                if websocket.client_state.name == "CONNECTED":
                    await manager.send_personal_message({
                        "type": "processing_state",
                        "is_processing": False
                    }, websocket)
                return
        except Exception:
            pass

        # If a final was already sent very recently with the same content, skip
        try:
            now = time.time()
            norm = (transcribed_text or '').strip().lower()
            if norm and (now - float(session_data.get('final_sent_at') or 0)) < 2.0 and norm == (session_data.get('last_final_norm') or ''):
                logger.info("[WS] Skipping duplicate final after prior final (audio_data)")
                if websocket.client_state.name == "CONNECTED":
                    await manager.send_personal_message({
                        "type": "processing_state",
                        "is_processing": False
                    }, websocket)
                return
        except Exception:
            pass

        # Increment utterance sequence for this final
        try:
            session_data['utterance_seq'] = int(session_data.get('utterance_seq') or 0) + 1
        except Exception:
            session_data['utterance_seq'] = 1
        utter_seq = session_data['utterance_seq']

        # Send transcript to client (only if still connected)
        if websocket.client_state.name == "CONNECTED":
            await manager.send_personal_message({
                "type": "final_transcript",
                "transcript": transcribed_text,
                "is_final": True,
                "utterance_seq": utter_seq
            }, websocket)
        
        # Fetch dynamic system prompt with doctor's name and hospital
        dynamic_prompt = None
        try:
            if session_data.get('consultation_id'):
                async with AsyncSessionLocal() as db:
                    from service.consultation_service import get_consultation_details
                    from system_prompt import get_dynamic_system_prompt
                    
                    consultation_id = int(session_data['consultation_id'])
                    consultation = await get_consultation_details(db, consultation_id=consultation_id)
                    if consultation and consultation.doctor_id:
                        dynamic_prompt = await get_dynamic_system_prompt(db, consultation.doctor_id, consultation_id)
                        logger.info(f"Using dynamic prompt for doctor_id={consultation.doctor_id}")
        except Exception as e:
            logger.warning(f"Failed to fetch dynamic prompt: {e}, using default")
        
        # Generate AI response with STREAMING and real-time TTS
        ai_start_time = time.time()
        lang = (language or 'en').split('-')[0].lower()
        
        # Stream tokens from OpenAI and send to TTS in real-time with ULTRA-FAST first chunk
        if lang == 'en':
            prompt_text = transcribed_text
            
            # Use streaming API with optimized parameters for faster response
            full_response = ""
            sentence_buffer = ""
            chunk_count = 0
            first_chunk_sent = False
            first_chunk_threshold = 5  # Send first chunk after 5 words for better balance
            
            for token in openai_service.generate_response_stream(
                prompt=f"Patient said: {prompt_text}",
                max_tokens=200,  # Reduced for faster generation
                temperature=0.2,  # More deterministic for faster response
                top_p=0.8,
                request_id=session_data['request_id'],
                session_id=session_data['session_id'],
                user_language='en',
                system_prompt=dynamic_prompt
            ):
                full_response += token
                sentence_buffer += token
                
                # ULTRA-FAST first chunk delivery - send after just a few words
                if not first_chunk_sent and len(sentence_buffer.split()) >= first_chunk_threshold:
                    first_chunk_sent = True
                    chunk_count += 1
                    # Send first chunk immediately for ultra-low latency
                    if websocket.client_state.name == "CONNECTED":
                        await manager.send_personal_message({
                            "type": "ai_response_chunk",
                            "text": sentence_buffer.strip(),
                            "is_final": False,
                            "chunk_id": chunk_count,
                            "is_first_chunk": True
                        }, websocket)
                        logger.info(f"ULTRA-FAST First Chunk sent: {len(sentence_buffer)} chars")
                
                # Continue with sentence-based chunking for remaining text
                elif any(sentence_buffer.rstrip().endswith(punct) for punct in ['.', '!', '?', '।']):
                    sentence = sentence_buffer.strip()
                    if len(sentence) > 8:  # Balanced threshold for good delivery
                        chunk_count += 1
                        # Send sentence chunk to client for TTS
                        if websocket.client_state.name == "CONNECTED":
                            await manager.send_personal_message({
                                "type": "ai_response_chunk",
                                "text": sentence,
                                "is_final": False,
                                "chunk_id": chunk_count
                            }, websocket)
                        sentence_buffer = ""
            
            # Send any remaining text
            if sentence_buffer.strip():
                chunk_count += 1
                if websocket.client_state.name == "CONNECTED":
                    await manager.send_personal_message({
                        "type": "ai_response_chunk",
                        "text": sentence_buffer.strip(),
                        "is_final": True,
                        "chunk_id": chunk_count
                    }, websocket)
            
            final_response = full_response
            
        else:
            # For non-English: ULTRA-FAST async translate input, stream response, async translate output
            prompt_text = await translate_with_timeout(
                transcribed_text, 
                source_lang=lang, 
                target_lang='en',
                request_id=session_data['request_id'],
                session_id=session_data['session_id']
            )
            
            # Stream English response with ULTRA-FAST first chunk delivery
            response_en = ""
            sentence_buffer = ""
            chunk_count = 0
            first_chunk_sent = False
            first_chunk_threshold = 5  # Send first chunk after 5 words for better balance
            
            for token in openai_service.generate_response_stream(
                prompt=f"Patient said: {prompt_text}",
                max_tokens=200,  # Reduced for faster generation
                temperature=0.2,  # More deterministic for faster response
                top_p=0.8,
                request_id=session_data['request_id'],
                session_id=session_data['session_id'],
                user_language='en',
                system_prompt=dynamic_prompt
            ):
                response_en += token
                sentence_buffer += token
                
                # ULTRA-FAST first chunk delivery - send after just a few words
                if not first_chunk_sent and len(sentence_buffer.split()) >= first_chunk_threshold:
                    first_chunk_sent = True
                    chunk_count += 1
                    # ULTRA-FAST async translate first chunk immediately for ultra-low latency
                    translated_first_chunk = await translate_with_timeout(
                        sentence_buffer.strip(),
                        source_lang='en',
                        target_lang=lang,
                        request_id=session_data['request_id'],
                        session_id=session_data['session_id']
                    )
                    
                    # Send first translated chunk immediately
                    if websocket.client_state.name == "CONNECTED":
                        await manager.send_personal_message({
                            "type": "ai_response_chunk",
                            "text": translated_first_chunk,
                            "is_final": False,
                            "chunk_id": chunk_count,
                            "is_first_chunk": True
                        }, websocket)
                        logger.info(f"ULTRA-FAST First Chunk (translated) sent: {len(translated_first_chunk)} chars")
                
                # Continue with sentence-based chunking for remaining text
                elif any(sentence_buffer.rstrip().endswith(punct) for punct in ['.', '!', '?']):
                    sentence = sentence_buffer.strip()
                    if len(sentence) > 8:  # Balanced threshold for good delivery
                        # ULTRA-FAST async translate sentence to target language
                        translated_sentence = await translate_with_timeout(
                            sentence,
                            source_lang='en',
                            target_lang=lang,
                            request_id=session_data['request_id'],
                            session_id=session_data['session_id']
                        )
                        
                        chunk_count += 1
                        # Send translated chunk to client for TTS
                        if websocket.client_state.name == "CONNECTED":
                            await manager.send_personal_message({
                                "type": "ai_response_chunk",
                                "text": translated_sentence,
                                "is_final": False,
                                "chunk_id": chunk_count
                            }, websocket)
                        sentence_buffer = ""
            
            # ULTRA-FAST async translate and send remaining text
            if sentence_buffer.strip():
                translated_final = await translate_with_timeout(
                    sentence_buffer.strip(),
                    source_lang='en',
                    target_lang=lang,
                    request_id=session_data['request_id'],
                    session_id=session_data['session_id']
                )
                
                chunk_count += 1
                if websocket.client_state.name == "CONNECTED":
                    await manager.send_personal_message({
                        "type": "ai_response_chunk",
                        "text": translated_final,
                        "is_final": True,
                        "chunk_id": chunk_count
                    }, websocket)
            
            # ULTRA-FAST async translate full response for storage
            final_response = await translate_with_timeout(
                response_en,
                source_lang='en',
                target_lang=lang,
                request_id=session_data['request_id'],
                session_id=session_data['session_id']
            )
        
        ai_latency = int((time.time() - ai_start_time) * 1000)
        logger.info(f"AI response generated in {ai_latency}ms")
        
        # Comprehensive logging (best-effort)
        try:
            logger.info(f"[WS] Attempting logging - db_session_id={session_data.get('db_session_id')}, consultation_id={session_data.get('consultation_id')}")
            if session_data.get('db_session_id') and session_data.get('consultation_id'):
                async with AsyncSessionLocal() as db:
                    # Get consultation details for proper logging using service layer
                    from service.analytics_service import log_deepgram_stt, log_sarvam_stt, log_openai_chat
                    from service.consultation_service import append_message, get_consultation_details
                    
                    consultation = await get_consultation_details(db, consultation_id=int(session_data['consultation_id']))
                    
                    if consultation:
                        # Log STT with analytics service
                        if session_data.get('provider') == "deepgram":
                            logger.info(f"[WS] Logging Deepgram STT for session {session_data['db_session_id']}")
                            await log_deepgram_stt(
                                db=db,
                                audio_duration_sec=session_data.get('audio_duration', 0),
                                response_time_ms=int(stt_latency),
                                transcript=transcribed_text,
                                status="success",
                                session_id=int(session_data['db_session_id']),
                                doctor_id=consultation.doctor_id,
                                patient_id=consultation.patient_id,
                                hospital_id=consultation.hospital_id
                            )
                            logger.info(f"Deepgram STT logged for session {session_data['db_session_id']}")
                        elif session_data.get('provider') == "sarvam":
                            logger.info(f"[WS] Logging Sarvam STT for session {session_data['db_session_id']}")
                            await log_sarvam_stt(
                                db=db,
                                audio_duration_sec=session_data.get('audio_duration', 0),
                                response_time_ms=int(stt_latency),
                                transcript=transcribed_text,
                                status="success",
                                session_id=int(session_data['db_session_id']),
                                doctor_id=consultation.doctor_id,
                                patient_id=consultation.patient_id,
                                hospital_id=consultation.hospital_id
                            )
                            logger.info(f"Sarvam STT logged for session {session_data['db_session_id']}")
                        
                        # Log OpenAI response with analytics service
                        logger.info(f"[WS] Logging OpenAI chat for session {session_data['db_session_id']}")
                        await log_openai_chat(
                            db=db,
                            input_tokens=len(transcribed_text.split()),
                            output_tokens=len(final_response.split()),
                            response_time_ms=int(ai_latency),
                            status="success",
                            session_id=int(session_data['db_session_id']),
                            doctor_id=consultation.doctor_id,
                            patient_id=consultation.patient_id,
                            hospital_id=consultation.hospital_id
                        )
                        logger.info(f"OpenAI chat logged for session {session_data['db_session_id']}")
                        
                        # Log messages to consultation_messages
                        await append_message(
                            db,
                            session_id=int(session_data['db_session_id']),
                            sender_type="patient",
                            message_text=transcribed_text,
                            audio_url=None,
                            processing_time_ms=int(stt_latency)
                        )
                        
                        await append_message(
                            db,
                            session_id=int(session_data['db_session_id']),
                            sender_type="assistant",
                            message_text=final_response,
                            audio_url=None,
                            processing_time_ms=int(ai_latency)
                        )
                    else:
                        logger.warning(f"[WS] No consultation found for consultation_id={session_data.get('consultation_id')}")
            else:
                logger.warning(f"[WS] Skipping logging - missing db_session_id or consultation_id")
        except Exception as e:
            logger.warning(f"[WS] Logging failed: {e}")

        # Send AI response to client (only if still connected)
        if websocket.client_state.name == "CONNECTED":
            await manager.send_personal_message({
                "type": "response",
                "final_response": final_response,
                "transcript": transcribed_text,
                "metrics": {
                    "stt_latency_ms": stt_latency,
                    "ai_latency_ms": ai_latency,
                    "total_latency_ms": stt_latency + ai_latency
                },
                "utterance_seq": utter_seq
            }, websocket)
        # Persist last final for dedupe window
        try:
            session_data['last_final_norm'] = (transcribed_text or '').strip().lower()
            session_data['last_final_time'] = time.time()
            session_data['final_sent_at'] = session_data['last_final_time']
        except Exception:
            pass
        
        # Notify client that processing is complete (only if still connected)
        if websocket.client_state.name == "CONNECTED":
            await manager.send_personal_message({
                "type": "processing_state",
                "is_processing": False
            }, websocket)
        
    except Exception as e:
        logger.error(f"Error processing audio data: {e}")
        
        # Send error to client (only if still connected)
        if websocket.client_state.name == "CONNECTED":
            try:
                await manager.send_personal_message({
                    "type": "error",
                    "message": f"Audio processing failed: {str(e)}"
                }, websocket)
                
                # Reset processing state
                await manager.send_personal_message({
                    "type": "processing_state",
                    "is_processing": False
                }, websocket)
            except:
                pass  # Don't try to send error if connection is broken
    
    finally:
        session_data['is_processing'] = False

async def handle_flush_signal(websocket: WebSocket, session_data: dict):
    """Force STT provider to process buffered audio immediately."""
    try:
        provider = session_data.get('provider', 'sarvam').lower()
        
        if provider == 'deepgram' or provider == 'deepgram-nova3':
            # Finalize Deepgram by transcribing buffered audio now
            dg_entry = manager.deepgram_map.get(websocket)
            if not dg_entry:
                logger.info("[Deepgram STT] Flush with no buffer; ignoring")
                return
            data = bytes(dg_entry.get('buffer') or b'')
            if not data:
                logger.info("[Deepgram STT] Flush with empty buffer; ignoring")
                return
            try:
                task = dg_entry.get('debounce_task')
                if task and not task.done():
                    task.cancel()
            except Exception:
                pass
            wav_bytes = data
            if dg_entry.get('client_encoding') == 'pcm':
                try:
                    import struct
                    num_channels = 1
                    bits_per_sample = 16
                    sr = dg_entry.get('sample_rate') or 16000
                    byte_rate = sr * num_channels * bits_per_sample // 8
                    block_align = num_channels * bits_per_sample // 8
                    data_size = len(data)
                    riff_chunk_size = 36 + data_size
                    wav_header = b'RIFF' + struct.pack('<I', riff_chunk_size) + b'WAVE' + \
                        b'fmt ' + struct.pack('<I', 16) + struct.pack('<H', 1) + \
                        struct.pack('<H', num_channels) + struct.pack('<I', sr) + \
                        struct.pack('<I', byte_rate) + struct.pack('<H', block_align) + struct.pack('<H', bits_per_sample) + \
                        b'data' + struct.pack('<I', data_size)
                    wav_bytes = wav_header + data
                except Exception:
                    wav_bytes = data
            else:
                try:
                    from routes.routes_conversation import webm_to_wav_bytes
                    wav_bytes = webm_to_wav_bytes(data)
                except Exception:
                    logger.info("[Deepgram STT] Flush: insufficient WEBM data to convert; ignoring")
                    return
            try:
                dg_lang = _map_to_deepgram_language(session_data.get('language') or 'en-US')
                provider = session_data.get('provider', 'deepgram').lower()
                multilingual_mode = provider == 'deepgram-nova3' or session_data.get('multilingual', False) or dg_lang == 'multi'
                final_text = await deepgram_service.stt_streaming(
                    audio_bytes=wav_bytes,
                    language_code=dg_lang,
                    encoding="audio/wav",
                    sample_rate=dg_entry.get('sample_rate') or 16000,
                    request_id=session_data['request_id'],
                    session_id=session_data['session_id'],
                    multilingual=multilingual_mode
                )
                if final_text:
                    # Increment utterance sequence for this final
                    try:
                        session_data['utterance_seq'] = int(session_data.get('utterance_seq') or 0) + 1
                    except Exception:
                        session_data['utterance_seq'] = 1
                    utter_seq = session_data['utterance_seq']
                    await manager.send_personal_message({
                        "type": "final_transcript",
                        "transcript": final_text,
                        "is_final": True,
                        "utterance_seq": utter_seq
                    }, websocket)
                dg_entry['buffer'].clear()
            except Exception as e:
                logger.warning(f"[Deepgram STT] Flush transcription failed: {e}")
            return
        
        # Sarvam flush logic
        sarvam_entry = manager.sarvam_ws_map.get(websocket)
        if sarvam_entry and sarvam_entry.get('ws'):
            try:
                await sarvam_entry['ws'].flush()
                logger.info("[Sarvam STT] Flush signal sent (client-initiated)")
                # After flush, if we have buffered transcript, emit as final and send AI response
                final_text = (sarvam_entry.get('accumulated') or sarvam_entry.get('partial') or '').strip()
                if final_text:
                    await manager.send_personal_message({
                        "type": "final_transcript",
                        "transcript": final_text,
                        "is_final": True
                    }, websocket)
                    # Mark final sent for dedupe window
                    try:
                        session_data['last_final_norm'] = (final_text or '').strip().lower()
                        session_data['final_sent_at'] = time.time()
                    except Exception:
                        pass
                    try:
                        # Fetch dynamic system prompt with doctor's name and hospital
                        dynamic_prompt = None
                        try:
                            if session_data.get('consultation_id'):
                                async with AsyncSessionLocal() as db_temp:
                                    from service.consultation_service import get_consultation_details
                                    from system_prompt import get_dynamic_system_prompt
                                    
                                    consultation_id_temp = int(session_data['consultation_id'])
                                    consultation_temp = await get_consultation_details(db_temp, consultation_id=consultation_id_temp)
                                    if consultation_temp and consultation_temp.doctor_id:
                                        dynamic_prompt = await get_dynamic_system_prompt(db_temp, consultation_temp.doctor_id, consultation_id_temp)
                                        logger.info(f"Using dynamic prompt (flush) for doctor_id={consultation_temp.doctor_id}")
                        except Exception as e:
                            logger.warning(f"Failed to fetch dynamic prompt (flush): {e}, using default")
                        
                        ai_start_time = time.time()
                        lang = (session_data.get('language') or 'en').split('-')[0].lower()
                        
                        if lang == 'en':
                            prompt_text = final_text
                            final_response = openai_service.generate_response(
                                prompt=f"Patient said: {prompt_text}",
                                max_tokens=220,
                                temperature=0.3,
                                top_p=0.7,
                                request_id=session_data['request_id'],
                                session_id=session_data['session_id'],
                                user_language='en',
                                system_prompt=dynamic_prompt
                            )
                        else:
                            prompt_text = sarvam_service.text_translate(
                                final_text, 
                                source_lang=lang, 
                                target_lang='en',
                                request_id=session_data['request_id'],
                                session_id=session_data['session_id']
                            ) or final_text
                            
                            response_en = openai_service.generate_response(
                                prompt=f"Patient said: {prompt_text}",
                                max_tokens=220,
                                temperature=0.3,
                                top_p=0.7,
                                request_id=session_data['request_id'],
                                session_id=session_data['session_id'],
                                user_language='en',
                                system_prompt=dynamic_prompt
                            )
                            
                            final_response = await translate_with_timeout(
                                response_en,
                                source_lang='en',
                                target_lang=lang,
                                request_id=session_data['request_id'],
                                session_id=session_data['session_id']
                            )
                        ai_latency = int((time.time() - ai_start_time) * 1000)
                        # Comprehensive logging
                        try:
                            if session_data.get('db_session_id') and session_data.get('consultation_id'):
                                async with AsyncSessionLocal() as db:
                                    # Get consultation details for proper logging using service layer
                                    from service.analytics_service import log_sarvam_stt, log_openai_chat
                                    from service.consultation_service import append_message, get_consultation_details
                                    
                                    consultation = await get_consultation_details(db, consultation_id=int(session_data['consultation_id']))
                                    
                                    if consultation:
                                        # Log STT for Sarvam
                                        logger.info(f"[WS] Logging Sarvam STT for session {session_data['db_session_id']}")
                                        await log_sarvam_stt(
                                            db=db,
                                            audio_duration_sec=session_data.get('audio_duration', 0),
                                            response_time_ms=0,  # Streaming STT has no single latency
                                            transcript=final_text,
                                            status="success",
                                            session_id=int(session_data['db_session_id']),
                                            doctor_id=consultation.doctor_id,
                                            patient_id=consultation.patient_id,
                                            hospital_id=consultation.hospital_id
                                        )
                                        logger.info(f"Sarvam STT logged for session {session_data['db_session_id']}")
                                        
                                        # Log OpenAI response with analytics service
                                        logger.info(f"[WS] Logging OpenAI chat for session {session_data['db_session_id']}")
                                        await log_openai_chat(
                                            db=db,
                                            input_tokens=len(final_text.split()),
                                            output_tokens=len(final_response.split()),
                                            response_time_ms=int(ai_latency),
                                            status="success",
                                            session_id=int(session_data['db_session_id']),
                                            doctor_id=consultation.doctor_id,
                                            patient_id=consultation.patient_id,
                                            hospital_id=consultation.hospital_id
                                        )
                                        logger.info(f"OpenAI chat logged for session {session_data['db_session_id']}")
                                        
                                        # Log messages
                                        await append_message(
                                            db,
                                            session_id=int(session_data['db_session_id']),
                                            sender_type="patient",
                                            message_text=final_text,
                                            audio_url=None,
                                            processing_time_ms=0
                                        )
                                        
                                        await append_message(
                                            db,
                                            session_id=int(session_data['db_session_id']),
                                            sender_type="assistant",
                                            message_text=final_response,
                                            audio_url=None,
                                            processing_time_ms=int(ai_latency)
                                        )
                        except Exception as e:
                            logger.warning(f"[WS] Logging (flush) failed: {e}")
                        await manager.send_personal_message({
                            "type": "response",
                            "final_response": final_response,
                            "transcript": final_text,
                            "metrics": {
                                "stt_latency_ms": 0,
                                "ai_latency_ms": ai_latency,
                                "total_latency_ms": ai_latency
                            }
                        }, websocket)
                    except Exception as e:
                        logger.warning(f"[Sarvam STT] AI response failed: {e}")
                    sarvam_entry['partial'] = ''
                    sarvam_entry['accumulated'] = ''
            except Exception as e:
                logger.warning(f"[Sarvam STT] Flush failed: {e}")
        else:
            logger.info("[Sarvam STT] No active WS to flush")
    except Exception as e:
        logger.error(f"Error handling flush signal: {e}")

async def handle_audio_chunk(websocket: WebSocket, message: dict, session_data: dict):
    """Handle real-time audio chunks for streaming processing"""
    try:
        if session_data['is_processing']:
            logger.warning("Already processing audio for this session, skipping chunk.")
            return

        audio_b64 = message.get("audio")
        language_code = message.get("language", "en-IN")
        provider = (message.get('provider') or 'sarvam').lower()
        is_streaming = message.get("is_streaming", True)
        client_encoding = message.get("encoding") or "webm"
        client_sample_rate = int(message.get("sample_rate") or 16000)
        
        if not audio_b64:
            logger.warning("No audio data in chunk")
            return

        audio_bytes = base64.b64decode(audio_b64)
        
        # Skip empty or very small audio chunks to avoid unnecessary processing
        if len(audio_bytes) == 0:
            logger.debug("[WS:audio_chunk] Skipping empty audio chunk")
            return
        elif len(audio_bytes) < 100:  # Skip chunks smaller than 100 bytes (likely silence/noise)
            logger.debug(f"[WS:audio_chunk] Skipping very small audio chunk: {len(audio_bytes)}B")
            return
        
        logger.info(f"[WS:audio_chunk] provider={provider} enc={client_encoding} sr={client_sample_rate} size={len(audio_bytes)}B")

        # For Sarvam, maintain a session-scoped WS and forward chunks
        if provider == 'deepgram' or provider == 'deepgram-nova3':
            # Buffer Deepgram chunks and debounce interim transcription
            dg_entry = manager.deepgram_map.get(websocket)
            if not dg_entry:
                dg_entry = {
                    'buffer': bytearray(),
                    'last_emit': 0.0,
                    'debounce_task': None,
                    'client_encoding': client_encoding,
                    'sample_rate': client_sample_rate,
                    'last_emit_time': 0.0,
                    'finalize_task': None,
                    'last_buf_len': 0
                }
                manager.deepgram_map[websocket] = dg_entry

            dg_entry['client_encoding'] = client_encoding
            dg_entry['sample_rate'] = client_sample_rate
            # Append new audio and cancel any pending finalize-as-final tasks
            dg_entry['buffer'].extend(audio_bytes)
            try:
                if dg_entry.get('finalize_task') and not dg_entry['finalize_task'].done():
                    dg_entry['finalize_task'].cancel()
            except Exception:
                pass

            async def _debounced_transcribe():
                try:
                    await asyncio.sleep(0.25)
                    # Abort if websocket is no longer connected
                    if websocket not in manager.active_connections or websocket.client_state.name != "CONNECTED":
                        return
                    # Cap buffer size to avoid unbounded growth; keep last 200KB
                    MAX_BUFFER_BYTES = 200_000
                    if len(dg_entry['buffer']) > MAX_BUFFER_BYTES:
                        dg_entry['buffer'] = bytearray(dg_entry['buffer'][-MAX_BUFFER_BYTES:])
                    data = bytes(dg_entry['buffer'])
                    if len(data) < 2000:
                        return
                    # Only transcribe if buffer grew enough since last emit to avoid duplicates
                    last_emit = dg_entry.get('last_emit') or 0
                    growth = len(data) - last_emit
                    if growth < 6000 and (time.time() - (dg_entry.get('last_emit_time') or 0)) < 1.0:
                        return
                    # Prepare WAV
                    wav_bytes = data
                    if dg_entry['client_encoding'] == 'pcm':
                        try:
                            import struct
                            num_channels = 1
                            bits_per_sample = 16
                            sr = dg_entry['sample_rate'] or 16000
                            byte_rate = sr * num_channels * bits_per_sample // 8
                            block_align = num_channels * bits_per_sample // 8
                            data_size = len(data)
                            riff_chunk_size = 36 + data_size
                            wav_header = b'RIFF' + struct.pack('<I', riff_chunk_size) + b'WAVE' + \
                                b'fmt ' + struct.pack('<I', 16) + struct.pack('<H', 1) + \
                                struct.pack('<H', num_channels) + struct.pack('<I', sr) + \
                                struct.pack('<I', byte_rate) + struct.pack('<H', block_align) + struct.pack('<H', bits_per_sample) + \
                                b'data' + struct.pack('<I', data_size)
                            wav_bytes = wav_header + data
                        except Exception:
                            wav_bytes = data
                    else:
                        try:
                            from routes.routes_conversation import webm_to_wav_bytes
                            wav_bytes = webm_to_wav_bytes(data)
                        except Exception:
                            return

                    dg_lang = _map_to_deepgram_language(language_code)
                    logger.info(f"[Deepgram STT] debounced bytes={len(wav_bytes)} lang={dg_lang} sr={dg_entry['sample_rate'] or 16000}")
                    multilingual_mode = provider == 'deepgram-nova3' or session_data.get('multilingual', False) or dg_lang == 'multi'
                    transcript = await deepgram_service.stt_streaming(
                        audio_bytes=wav_bytes,
                        language_code=dg_lang,
                        encoding="audio/wav",
                        sample_rate=dg_entry['sample_rate'] or 16000,
                        request_id=session_data['request_id'],
                        session_id=session_data['session_id'],
                        multilingual=multilingual_mode
                    )
                    if transcript and websocket.client_state.name == "CONNECTED":
                        await manager.send_personal_message({
                            "type": "streaming_transcript",
                            "transcript": transcript
                        }, websocket)
                        dg_entry['last_emit'] = len(data)
                        dg_entry['last_emit_time'] = time.time()
                        # Schedule an inactivity-based finalize to promote final transcript and AI
                        # Only if buffer stays unchanged for a short interval
                        saved_len = len(dg_entry['buffer'])
                        dg_entry['last_buf_len'] = saved_len
                        async def _finalize_if_idle(expected_len: int):
                            try:
                                await asyncio.sleep(0.8)
                                # Abort if socket gone or new audio arrived
                                if websocket not in manager.active_connections or websocket.client_state.name != "CONNECTED":
                                    return
                                current_len = len(dg_entry.get('buffer') or b'')
                                if current_len == expected_len:
                                    await handle_flush_signal(websocket, session_data)
                            except asyncio.CancelledError:
                                return
                            except Exception as e:
                                logger.warning(f"[Deepgram STT] Idle finalize failed: {e}")
                            finally:
                                dg_entry['finalize_task'] = None
                        try:
                            if dg_entry.get('finalize_task') and not dg_entry['finalize_task'].done():
                                dg_entry['finalize_task'].cancel()
                        except Exception:
                            pass
                        dg_entry['finalize_task'] = asyncio.create_task(_finalize_if_idle(saved_len))
                    # After a transcription attempt, clear buffer to prevent repeated reprocessing
                    dg_entry['buffer'].clear()
                except asyncio.CancelledError:
                    return
                except Exception as e:
                    logger.warning(f"[Deepgram STT] Debounced chunk transcription failed: {e}")
                finally:
                    dg_entry['debounce_task'] = None

            try:
                if dg_entry['debounce_task'] and not dg_entry['debounce_task'].done():
                    dg_entry['debounce_task'].cancel()
            except Exception:
                pass
            dg_entry['debounce_task'] = asyncio.create_task(_debounced_transcribe())
            return
        
        # Ensure Sarvam WS exists for this websocket
        sarvam_entry = manager.sarvam_ws_map.get(websocket)
        if not sarvam_entry or sarvam_entry.get('closed'):
            sarvam_entry = { 'ws': None, 'task': None, 'language_code': language_code, 'ready': asyncio.Event() }
            manager.sarvam_ws_map[websocket] = sarvam_entry

            async def _connect_and_listen():
                try:
                    from sarvamai import AsyncSarvamAI
                    client = AsyncSarvamAI(api_subscription_key=sarvam_service.api_key)
                    async with client.speech_to_text_streaming.connect(
                        language_code=language_code,
                        model="saarika:v2.5",
                        high_vad_sensitivity=True,
                        vad_signals=True,
                        input_audio_codec="wav",
                        sample_rate=16000
                    ) as ws:
                        sarvam_entry['ws'] = ws
                        sarvam_entry['partial'] = ''
                        sarvam_entry['accumulated'] = ''
                        sarvam_entry['ready'].set()
                        sarvam_entry['finalize_task'] = None
                        logger.info("[Sarvam STT] Session WS connected")

                        # Listen and relay messages back to browser
                        while True:
                            try:
                                msg = await ws.recv()
                                # Idle finalization timer: schedule after each message
                                # If no more messages within 3 seconds, emit final (possibly empty)
                                # (client already also sends a flush on silence; this is a fallback)
                                # No persistent state here beyond using the partial buffer.
                                # Relay VAD events
                                if hasattr(msg, 'type') and msg.type == 'events':
                                    signal_type = getattr(msg.data, 'signal_type', '')
                                    await manager.send_personal_message({
                                        "type": "vad_signal",
                                        "signal_type": signal_type
                                    }, websocket)
                                    # Start of speech: reset only the partial buffer
                                    # Do NOT reset 'accumulated' here so earlier segments in the same
                                    # user utterance are preserved until an explicit END_SPEECH/final.
                                    if signal_type == 'START_SPEECH':
                                        # Cancel any pending finalization
                                        try:
                                            if sarvam_entry.get('finalize_task') and not sarvam_entry['finalize_task'].done():
                                                sarvam_entry['finalize_task'].cancel()
                                        except Exception:
                                            pass
                                        sarvam_entry['finalize_task'] = None
                                        sarvam_entry['partial'] = ''
                                    # End of speech: emit final transcript if any
                                    if signal_type == 'END_SPEECH':
                                        # Debounce finalization slightly to avoid splitting mid-phrase
                                        try:
                                            if sarvam_entry.get('finalize_task') and not sarvam_entry['finalize_task'].done():
                                                sarvam_entry['finalize_task'].cancel()
                                        except Exception:
                                            pass
                                        async def _finalize_after_delay():
                                            try:
                                                await asyncio.sleep(0.4)
                                                final_text = (sarvam_entry.get('accumulated') or sarvam_entry.get('partial') or '').strip()
                                                if final_text:
                                                    await manager.send_personal_message({
                                                        "type": "final_transcript",
                                                        "transcript": final_text,
                                                        "is_final": True
                                                    }, websocket)
                                                    # Mark final sent for dedupe window
                                                    try:
                                                        session_data['last_final_norm'] = (final_text or '').strip().lower()
                                                        session_data['final_sent_at'] = time.time()
                                                    except Exception:
                                                        pass
                                                    # Also send AI response immediately
                                                    try:
                                                        ai_start_time = time.time()
                                                        lang = (session_data.get('language') or 'en').split('-')[0].lower()
                                                        
                                                        if lang == 'en':
                                                            prompt_text = final_text
                                                            final_response = openai_service.generate_response(
                                                                prompt=f"Patient said: {prompt_text}",
                                                                max_tokens=220,
                                                                temperature=0.3,
                                                                top_p=0.7,
                                                                request_id=session_data['request_id'],
                                                                session_id=session_data['session_id'],
                                                                user_language='en'
                                                            )
                                                        else:
                                                            prompt_text = await translate_with_timeout(
                                                                final_text, 
                                                                source_lang=lang, 
                                                                target_lang='en',
                                                                request_id=session_data['request_id'],
                                                                session_id=session_data['session_id']
                                                            )
                                                            
                                                            response_en = openai_service.generate_response(
                                                                prompt=f"Patient said: {prompt_text}",
                                                                max_tokens=220,
                                                                temperature=0.3,
                                                                top_p=0.7,
                                                                request_id=session_data['request_id'],
                                                                session_id=session_data['session_id'],
                                                                user_language='en'
                                                            )
                                                            
                                                            final_response = await translate_with_timeout(
                                                                response_en,
                                                                source_lang='en',
                                                                target_lang=lang,
                                                                request_id=session_data['request_id'],
                                                                session_id=session_data['session_id']
                                                            )
                                                        ai_latency = int((time.time() - ai_start_time) * 1000)
                                                        
                                                        # Log STT and OpenAI
                                                        try:
                                                            if session_data.get('db_session_id') and session_data.get('consultation_id'):
                                                                async with AsyncSessionLocal() as db:
                                                                    from service.analytics_service import log_sarvam_stt, log_openai_chat
                                                                    from service.consultation_service import append_message, get_consultation_details
                                                                    
                                                                    consultation = await get_consultation_details(db, consultation_id=int(session_data['consultation_id']))
                                                                    
                                                                    if consultation:
                                                                        # Log Sarvam STT
                                                                        logger.info(f"[WS/END_SPEECH] Logging Sarvam STT for session {session_data['db_session_id']}")
                                                                        await log_sarvam_stt(
                                                                            db=db,
                                                                            audio_duration_sec=session_data.get('audio_duration', 0),
                                                                            response_time_ms=0,
                                                                            transcript=final_text,
                                                                            status="success",
                                                                            session_id=int(session_data['db_session_id']),
                                                                            doctor_id=consultation.doctor_id,
                                                                            patient_id=consultation.patient_id,
                                                                            hospital_id=consultation.hospital_id
                                                                        )
                                                                        logger.info(f"Sarvam STT logged (END_SPEECH) for session {session_data['db_session_id']}")
                                                                        
                                                                        # Log OpenAI
                                                                        logger.info(f"[WS/END_SPEECH] Logging OpenAI chat for session {session_data['db_session_id']}")
                                                                        await log_openai_chat(
                                                                            db=db,
                                                                            input_tokens=len(final_text.split()),
                                                                            output_tokens=len(final_response.split()),
                                                                            response_time_ms=int(ai_latency),
                                                                            status="success",
                                                                            session_id=int(session_data['db_session_id']),
                                                                            doctor_id=consultation.doctor_id,
                                                                            patient_id=consultation.patient_id,
                                                                            hospital_id=consultation.hospital_id
                                                                        )
                                                                        logger.info(f"OpenAI chat logged (END_SPEECH) for session {session_data['db_session_id']}")
                                                                        
                                                                        # Log messages
                                                                        await append_message(
                                                                            db,
                                                                            session_id=int(session_data['db_session_id']),
                                                                            sender_type="patient",
                                                                            message_text=final_text,
                                                                            audio_url=None,
                                                                            processing_time_ms=0
                                                                        )
                                                                        
                                                                        await append_message(
                                                                            db,
                                                                            session_id=int(session_data['db_session_id']),
                                                                            sender_type="assistant",
                                                                            message_text=final_response,
                                                                            audio_url=None,
                                                                            processing_time_ms=int(ai_latency)
                                                                        )
                                                        except Exception as log_e:
                                                            logger.warning(f"[WS/END_SPEECH] Logging failed: {log_e}")
                                                        
                                                        await manager.send_personal_message({
                                                            "type": "response",
                                                            "final_response": final_response,
                                                            "transcript": final_text,
                                                            "metrics": {
                                                                "stt_latency_ms": 0,
                                                                "ai_latency_ms": ai_latency,
                                                                "total_latency_ms": ai_latency
                                                            }
                                                        }, websocket)
                                                    except Exception as e:
                                                        logger.warning(f"[Sarvam STT] AI response failed: {e}")
                                                    sarvam_entry['partial'] = ''
                                                    sarvam_entry['accumulated'] = ''
                                            except asyncio.CancelledError:
                                                return
                                        sarvam_entry['finalize_task'] = asyncio.create_task(_finalize_after_delay())
                                # Relay transcript data
                                elif hasattr(msg, 'type') and msg.type == 'data':
                                    transcript = getattr(msg.data, 'transcript', None)
                                    if transcript:
                                        # Any new data indicates speech continuation; cancel pending finalization
                                        try:
                                            if sarvam_entry.get('finalize_task') and not sarvam_entry['finalize_task'].done():
                                                sarvam_entry['finalize_task'].cancel()
                                        except Exception:
                                            pass
                                        sarvam_entry['finalize_task'] = None
                                        new_text = (transcript or '').strip()
                                        prev = (sarvam_entry.get('partial') or '').strip()
                                        accumulated = sarvam_entry.get('accumulated') or ''

                                        # Heuristic merge: cumulative vs new segment
                                        looks_cumulative = False
                                        if prev:
                                            min_overlap = max(1, int(len(prev) * 0.6))
                                            looks_cumulative = len(new_text) >= len(prev) and (
                                                new_text.startswith(prev) or new_text.find(prev[:min_overlap]) >= 0
                                            )

                                        if not accumulated:
                                            accumulated = new_text
                                        elif looks_cumulative:
                                            # Replace tail prev with refined new_text when possible
                                            if accumulated.endswith(prev):
                                                accumulated = accumulated[:len(accumulated)-len(prev)] + new_text
                                            else:
                                                # Fallback: if prev appears near end, replace once
                                                idx = accumulated.rfind(prev)
                                                if idx != -1 and idx >= len(accumulated) - len(prev) - 10:
                                                    accumulated = accumulated[:idx] + new_text
                                                else:
                                                    # As last resort, set to new_text (prevents shrinking)
                                                    if len(new_text) > len(accumulated):
                                                        accumulated = new_text
                                        else:
                                            # Append new segment if not duplicate of tail
                                            tail = accumulated[-min(len(accumulated), 50):]
                                            if not tail.endswith(new_text) and not new_text.endswith(tail.strip()):
                                                needs_space = accumulated and not accumulated.endswith(' ')
                                                accumulated += (' ' if needs_space else '') + new_text

                                        sarvam_entry['partial'] = new_text
                                        sarvam_entry['accumulated'] = accumulated.strip()
                                        await manager.send_personal_message({
                                            "type": "streaming_transcript",
                                            "transcript": sarvam_entry['accumulated']
                                        }, websocket)
                                elif hasattr(msg, 'type') and msg.type == 'error':
                                    await manager.send_personal_message({
                                        "type": "error",
                                        "message": str(msg)
                                    }, websocket)
                            except Exception as e:
                                logger.info(f"[Sarvam STT] Listener ending: {e}")
                                break
                except Exception as e:
                    logger.error(f"[Sarvam STT] Connect/listen error: {e}")
                finally:
                    sarvam_entry['closed'] = True
                    try:
                        sarvam_entry['ready'].clear()
                    except Exception:
                        pass
            sarvam_entry['task'] = asyncio.create_task(_connect_and_listen())

        # Wait briefly for WS to be ready
        if sarvam_entry.get('ws') is None and sarvam_entry.get('ready'):
            # Give up to 1s for connection establishment
            try:
                await asyncio.wait_for(sarvam_entry['ready'].wait(), timeout=1.0)
            except Exception:
                logger.warning("[Sarvam STT] WS not ready within 1s")

        ws = sarvam_entry.get('ws')
        if not ws:
            logger.warning("[Sarvam STT] WS not ready; dropping chunk")
            return

        # Convert to WAV if needed; wrap PCM in minimal WAV so SDK accepts encoding='audio/wav'
        try:
            if client_encoding == 'pcm':
                # Wrap PCM16 in a minimal WAV header (mono, 16-bit, client_sample_rate)
                import struct
                num_channels = 1
                bits_per_sample = 16
                byte_rate = client_sample_rate * num_channels * bits_per_sample // 8
                block_align = num_channels * bits_per_sample // 8
                data_size = len(audio_bytes)
                riff_chunk_size = 36 + data_size
                wav_header = b'RIFF' + struct.pack('<I', riff_chunk_size) + b'WAVE' + \
                    b'fmt ' + struct.pack('<I', 16) + struct.pack('<H', 1) + \
                    struct.pack('<H', num_channels) + struct.pack('<I', client_sample_rate) + \
                    struct.pack('<I', byte_rate) + struct.pack('<H', block_align) + struct.pack('<H', bits_per_sample) + \
                    b'data' + struct.pack('<I', data_size)
                wav_bytes = wav_header + audio_bytes
                
                # Skip if WAV bytes are too small (just header + minimal data)
                if len(wav_bytes) <= 44:  # WAV header is 44 bytes
                    logger.debug(f"[Sarvam STT] Skipping very small WAV chunk: {len(wav_bytes)}B")
                    return
                
                b64 = base64.b64encode(wav_bytes).decode('utf-8')
                await ws.transcribe(audio=b64, encoding="audio/wav", sample_rate=client_sample_rate)
            else:
                try:
                    from routes.routes_conversation import webm_to_wav_bytes
                    wav_bytes = webm_to_wav_bytes(audio_bytes)
                except Exception as conv_e:
                    logger.warning(f"[Sarvam STT] WebM->WAV failed for chunk, using raw: {conv_e}")
                    wav_bytes = audio_bytes
                
                # Skip if WAV bytes are too small
                if len(wav_bytes) <= 100:  # Skip very small chunks
                    logger.debug(f"[Sarvam STT] Skipping very small WebM/WAV chunk: {len(wav_bytes)}B")
                    return
                
                b64 = base64.b64encode(wav_bytes).decode('utf-8')
                await ws.transcribe(audio=b64, encoding="audio/wav", sample_rate=16000)
        except Exception as e:
            logger.warning(f"[Sarvam STT] Chunk forward failed: {e}")
            
    except Exception as e:
        logger.error(f"Error processing audio chunk: {e}")
        if websocket.client_state.name == "CONNECTED":
            try:
                await manager.send_personal_message({
                    "type": "error",
                    "message": f"Audio chunk processing failed: {str(e)}"
                }, websocket)
            except:
                pass

async def handle_final_audio(websocket: WebSocket, message: dict, session_data: dict):
    """Handle final audio for complete processing and AI response"""
    try:
        if session_data['is_processing']:
            logger.warning("Already processing audio for this session, skipping final audio.")
            if websocket.client_state.name == "CONNECTED":
                await manager.send_personal_message({
                    "type": "processing_state",
                    "is_processing": True,
                    "message": "Already processing, please wait"
                }, websocket)
            return

        session_data['is_processing'] = True
        session_data['last_activity'] = time.time()
        
        if websocket.client_state.name == "CONNECTED":
            await manager.send_personal_message({
                "type": "processing_state",
                "is_processing": True
            }, websocket)

        audio_b64 = message.get("audio")
        language_code = message.get("language", "en-IN")
        provider = (message.get('provider') or 'sarvam').lower()
        is_streaming = message.get("is_streaming", False)
        
        if not audio_b64:
            raise ValueError("No final audio data received")

        audio_bytes = base64.b64decode(audio_b64)
        
        # Skip empty or very small audio chunks to avoid unnecessary processing
        if len(audio_bytes) == 0:
            logger.debug("[WS:final_audio] Skipping empty audio chunk")
            session_data['is_processing'] = False
            return
        elif len(audio_bytes) < 100:  # Skip chunks smaller than 100 bytes (likely silence/noise)
            logger.debug(f"[WS:final_audio] Skipping very small audio chunk: {len(audio_bytes)}B")
            session_data['is_processing'] = False
            return
        
        logger.info(f"[WS:final_audio] provider={provider} lang={language_code} size={len(audio_bytes)}B")

        # STT for final audio
        stt_start_time = time.time()
        if provider == 'deepgram' or provider == 'deepgram-nova3':
            dg_lang = _map_to_deepgram_language(language_code or 'en-US')
            # Use Deepgram STT streaming for final audio
            try:
                from routes.routes_conversation import webm_to_wav_bytes
                wav_bytes = webm_to_wav_bytes(audio_bytes)
            except Exception as conv_e:
                logger.warning(f"WebM->WAV conversion failed for Deepgram final: {conv_e}")
                wav_bytes = audio_bytes
            
            multilingual_mode = provider == 'deepgram-nova3' or session_data.get('multilingual', False) or dg_lang == 'multi'
            dg_result = await deepgram_service.stt_streaming(
                 audio_bytes=wav_bytes,
                 language_code=dg_lang,
                 encoding="audio/wav",
                 sample_rate=16000,
                 request_id=session_data['request_id'],
                 session_id=session_data['session_id'],
                 multilingual=multilingual_mode
             )
            # Get transcript text directly
            transcribed_text = dg_result or ''
        else:
            # For Sarvam, we now rely primarily on streaming interim transcripts.
            # If a final blob arrives (optional), we try flush on session WS and skip single-shot if empty.
            # Prefer using the session WS if available for finalization via flush
            sarvam_entry = manager.sarvam_ws_map.get(websocket)
            if sarvam_entry and sarvam_entry.get('ws'):
                try:
                    await sarvam_entry['ws'].flush()
                except Exception as e:
                    logger.warning(f"[Sarvam STT] Flush on final failed: {e}")
                # Do not block here; transcripts will arrive through listener
                transcribed_text = ""
            else:
                # No session WS; skip single-shot for Sarvam to avoid empty finals
                transcribed_text = ""
        stt_latency = int((time.time() - stt_start_time) * 1000)
        logger.info(f"Final audio transcribed in {stt_latency}ms: '{transcribed_text}'")

        if not transcribed_text or not transcribed_text.strip():
            logger.info("No meaningful transcript from final audio")
            if websocket.client_state.name == "CONNECTED":
                await manager.send_personal_message({
                    "type": "processing_state",
                    "is_processing": False
                }, websocket)
            return
        # Deduplicate finals to avoid double backend processing (final_audio)
        try:
            current_norm = (transcribed_text or '').strip().lower()
            last_norm = (session_data.get('last_final_norm') or '')
            last_time = float(session_data.get('last_final_time') or 0)
            if current_norm and last_norm and current_norm == last_norm and (time.time() - last_time) < 3.0:
                logger.info("[WS] Skipping duplicate final within 3s window (final_audio)")
                if websocket.client_state.name == "CONNECTED":
                    await manager.send_personal_message({
                        "type": "processing_state",
                        "is_processing": False
                    }, websocket)
                return
        except Exception:
            pass
        
        # Increment utterance sequence for this final
        try:
            session_data['utterance_seq'] = int(session_data.get('utterance_seq') or 0) + 1
        except Exception:
            session_data['utterance_seq'] = 1
        utter_seq = session_data['utterance_seq']

        # Send final transcript to client (only if we actually have it here)
        if transcribed_text and websocket.client_state.name == "CONNECTED":
             await manager.send_personal_message({
                 "type": "final_transcript",
                 "transcript": transcribed_text,
                 "is_final": True,
                 "utterance_seq": utter_seq
             }, websocket)
        
        # Generate AI response with translation
        ai_start_time = time.time()
        lang = (session_data.get('language') or 'en').split('-')[0].lower()
        
        if lang == 'en':
            prompt_text = transcribed_text
            final_response = openai_service.generate_response(
                prompt=f"Patient said: {prompt_text}",
                max_tokens=220,
                temperature=0.3,
                top_p=0.7,
                request_id=session_data['request_id'],
                session_id=session_data['session_id'],
                user_language='en'
            )
        else:
            prompt_text = await translate_with_timeout(
                transcribed_text, 
                source_lang=lang, 
                target_lang='en',
                request_id=session_data['request_id'],
                session_id=session_data['session_id']
            )
            
            response_en = openai_service.generate_response(
                prompt=f"Patient said: {prompt_text}",
                max_tokens=220,
                temperature=0.3,
                top_p=0.7,
                request_id=session_data['request_id'],
                session_id=session_data['session_id'],
                user_language='en'
            )
            
            final_response = await translate_with_timeout(
                response_en,
                source_lang='en',
                target_lang=lang,
                request_id=session_data['request_id'],
                session_id=session_data['session_id']
            )
        
        ai_latency = int((time.time() - ai_start_time) * 1000)
        logger.info(f"AI response generated in {ai_latency}ms")
        
        # Comprehensive logging AFTER AI response is generated
        try:
            if transcribed_text and session_data.get('db_session_id') and session_data.get('consultation_id'):
                async with AsyncSessionLocal() as db:
                    # Get consultation details for proper logging using service layer
                    from service.analytics_service import log_deepgram_stt, log_sarvam_stt, log_openai_chat
                    from service.consultation_service import append_message, get_consultation_details
                    
                    consultation = await get_consultation_details(db, consultation_id=int(session_data['consultation_id']))
                    
                    if consultation:
                        # Log STT with analytics service
                        if session_data.get('provider') == "deepgram":
                            await log_deepgram_stt(
                                db=db,
                                audio_duration_sec=session_data.get('audio_duration', 0),
                                response_time_ms=int(stt_latency),
                                transcript=transcribed_text,
                                status="success",
                                session_id=int(session_data['db_session_id']),
                                doctor_id=consultation.doctor_id,
                                patient_id=consultation.patient_id,
                                hospital_id=consultation.hospital_id
                            )
                        elif session_data.get('provider') == "sarvam":
                            await log_sarvam_stt(
                                db=db,
                                audio_duration_sec=session_data.get('audio_duration', 0),
                                response_time_ms=int(stt_latency),
                                transcript=transcribed_text,
                                status="success",
                                session_id=int(session_data['db_session_id']),
                                doctor_id=consultation.doctor_id,
                                patient_id=consultation.patient_id,
                                hospital_id=consultation.hospital_id
                            )
                        
                        # Log RAG retrieval if used
                        try:
                            from service.analytics_service import log_rag_retrieval
                            
                            # Access RAG service from openai_service to get actual retrieval metadata
                            if hasattr(openai_service, 'rag_service') and openai_service.rag_service:
                                rag_svc = openai_service.rag_service
                                if hasattr(rag_svc, 'last_retrieval_time') and rag_svc.last_retrieval_time > 0:
                                    await log_rag_retrieval(
                                        db=db,
                                        query_tokens=len(transcribed_text.split()),
                                        response_time_ms=int(rag_svc.last_retrieval_time * 1000),
                                        chunks_retrieved=rag_svc.last_chunks_count,
                                        status="success",
                                        session_id=int(session_data['db_session_id']),
                                        doctor_id=consultation.doctor_id,
                                        patient_id=consultation.patient_id,
                                        hospital_id=consultation.hospital_id
                                    )
                                    logger.info(f"RAG retrieval logged: {rag_svc.last_chunks_count} chunks in {int(rag_svc.last_retrieval_time*1000)}ms")
                        except Exception as rag_log_err:
                            logger.debug(f"RAG logging skipped: {rag_log_err}")
                        
                        # Log OpenAI response with analytics service (use actual token counts if available)
                        usage = getattr(openai_service, 'last_usage', {})
                        input_tokens = usage.get('input_tokens', len(transcribed_text.split()))
                        output_tokens = usage.get('output_tokens', len(final_response.split()))
                        
                        await log_openai_chat(
                            db=db,
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            response_time_ms=int(ai_latency),
                            status="success",
                            session_id=int(session_data['db_session_id']),
                            doctor_id=consultation.doctor_id,
                            patient_id=consultation.patient_id,
                            hospital_id=consultation.hospital_id
                        )
                        
                        # Log messages to consultation_messages
                        await append_message(
                            db,
                            session_id=int(session_data['db_session_id']),
                            sender_type="patient",
                            message_text=transcribed_text,
                            audio_url=None,
                            processing_time_ms=int(stt_latency)
                        )
                        
                        await append_message(
                            db,
                            session_id=int(session_data['db_session_id']),
                            sender_type="assistant",
                            message_text=final_response,
                            audio_url=None,
                            processing_time_ms=int(ai_latency)
                        )
                        logger.info(f"Final audio logging complete for session {session_data['db_session_id']}")
        except Exception as e:
            logger.error(f"[WS] Logging (final_audio) failed: {e}", exc_info=True)
        
        # Send AI response to client
        if websocket.client_state.name == "CONNECTED":
             await manager.send_personal_message({
                 "type": "response",
                 "final_response": final_response,
                 "transcript": transcribed_text,
                 "metrics": {
                     "stt_latency_ms": stt_latency,
                     "ai_latency_ms": ai_latency,
                     "total_latency_ms": stt_latency + ai_latency
                 },
                 "utterance_seq": utter_seq
             }, websocket)
        # Persist last final for dedupe window
        try:
            session_data['last_final_norm'] = (transcribed_text or '').strip().lower()
            session_data['last_final_time'] = time.time()
            session_data['final_sent_at'] = session_data['last_final_time']
        except Exception:
            pass
        
        # Notify client that processing is complete
        if websocket.client_state.name == "CONNECTED":
            await manager.send_personal_message({
                "type": "processing_state",
                "is_processing": False
            }, websocket)
        
    except Exception as e:
        logger.error(f"Error processing final audio: {e}")
        
        # Send error to client
        if websocket.client_state.name == "CONNECTED":
            try:
                await manager.send_personal_message({
                    "type": "error",
                    "message": f"Final audio processing failed: {str(e)}"
                }, websocket)
                
                # Reset processing state
                await manager.send_personal_message({
                    "type": "processing_state",
                    "is_processing": False
                }, websocket)
            except:
                pass  # Don't try to send error if connection is broken
    
    finally:
        session_data['is_processing'] = False

 
