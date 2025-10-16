"""
Sarvam STT Streaming Service
Handles speech-to-text streaming functionality
"""

import logging
import time
import asyncio
import base64
from typing import Optional
from sarvamai import AsyncSarvamAI
from config import settings

logger = logging.getLogger(__name__)


class SarvamSTTService:
    def __init__(self):
        self.api_key = settings.SARVAM_API_KEY

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
        return lang_map.get(lang_code, f"{lang_code}-IN")

    def speech_to_text(self, audio_file_path: str, language: str = "hi", request_id: str = None, session_id: str = None) -> Optional[str]:
        """Convert audio speech to text (STT only, no translation)"""
        start_time = time.time()
        request_id = request_id or f"stt-{int(time.time()*1000)}"
        
        try:
            import requests
            base_url = settings.SARVAM_BASE_URL
            url = f"{base_url}/speech-to-text"
            
            with open(audio_file_path, 'rb') as audio_file:
                files = {
                    'file': (audio_file_path.split('/')[-1], audio_file, 'audio/wav')
                }
                data = {
                    'language_code': self._convert_lang_code(language)
                }
                headers = {"api-subscription-key": self.api_key}
                response = requests.post(url, files=files, data=data, headers=headers)
            response.raise_for_status()

            result = response.json()
            transcribed_text = result.get('transcript', '')
            
            # Calculate latency and estimate audio duration
            latency_ms = int((time.time() - start_time) * 1000)
            import os
            audio_duration_sec = os.path.getsize(audio_file_path) / 32000  # Rough estimate
            
            # Log metrics (simplified logging without database for sync function)
            try:
                logger.info(f"Sarvam STT - Duration: {audio_duration_sec:.2f}s, Latency: {latency_ms}ms, Language: {language}")
            except Exception as log_error:
                logger.warning(f"Analytics logging failed: {log_error}")
            
            return transcribed_text

        except Exception as e:
            logger.error(f"Speech-to-text error: {str(e)}")
            try:
                error_response = e.response.text if hasattr(e, 'response') else str(e)
                logger.error(f"Sarvam API response: {error_response}")
            except:
                pass
            
            # Log error metrics (simplified logging without database)
            try:
                latency_ms = int((time.time() - start_time) * 1000)
                import os
                audio_duration_sec = os.path.getsize(audio_file_path) / 32000 if os.path.exists(audio_file_path) else 0
                logger.error(f"Sarvam STT Error - Duration: {audio_duration_sec:.2f}s, Latency: {latency_ms}ms, Error: {str(e)}")
            except Exception as log_error:
                logger.warning(f"Analytics logging failed: {log_error}")
            
            return None

    async def speech_to_text_streaming(
        self,
        audio_bytes: bytes,
        language_code: str = None,
        model: str = None,
        high_vad_sensitivity: bool = True,
        vad_signals: bool = True,
        encoding: str = "audio/wav",
        sample_rate: int = 16000,
        flush: bool = False,
        silence_timeout: float = 3.0,
        request_id: str = None,
        session_id: str = None
    ) -> Optional[str]:
        """Real-time VAD-based STT like Alexa/Siri"""
        start_time = time.time()
        request_id = request_id or f"stt-{int(time.time()*1000)}"
        
        try:
            language_code = self._convert_lang_code(language_code or "hi")
            model = model or settings.SARVAM_STT_MODEL
            
            logger.info(f"[Sarvam Real-time STT] Starting with VAD enabled")
            logger.info(f"Language: {language_code}, Model: {model}, Sample Rate: {sample_rate}")
            logger.info(f"High VAD Sensitivity: {high_vad_sensitivity}, VAD Signals: {vad_signals}")
            logger.info(f"Audio size: {len(audio_bytes)} bytes")
            
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            
            client = AsyncSarvamAI(api_subscription_key=self.api_key)
            async with client.speech_to_text_streaming.connect(
                language_code=language_code,
                model=model,
                high_vad_sensitivity=high_vad_sensitivity,
                vad_signals=vad_signals,
                input_audio_codec="wav" if encoding == "audio/wav" else "pcm",
                sample_rate=sample_rate
            ) as ws:
                logger.info("[Sarvam STT] WebSocket connected")
                
                await ws.transcribe(
                    audio=audio_b64,
                    encoding=encoding,
                    sample_rate=sample_rate
                )
                logger.info("[Sarvam STT] Audio data sent")
                
                # Send flush signal to force immediate processing
                try:
                    await ws.flush()
                    logger.info("[Sarvam STT] Flush signal sent")
                except Exception as flush_err:
                    logger.warning(f"[Sarvam STT] Flush failed: {flush_err}")
                
                transcripts = []
                last_speech_end = 0
                
                try:
                    # Set a longer timeout for the entire stream
                    timeout_task = asyncio.create_task(asyncio.sleep(15.0))
                    message_task = None
                    
                    while not timeout_task.done():
                        try:
                            if message_task is None:
                                message_task = asyncio.create_task(ws.recv())
                            
                            done, pending = await asyncio.wait(
                                [message_task, timeout_task],
                                return_when=asyncio.FIRST_COMPLETED,
                                timeout=1.0
                            )
                            
                            if timeout_task in done:
                                logger.info("[STT] Overall timeout reached")
                                break
                                
                            if message_task in done:
                                message = message_task.result()
                                message_task = None  # Reset for next iteration
                                logger.info(f"[Sarvam STT] Received message type: {type(message)}")
                                logger.info(f"[Sarvam STT] Received message: {message}")
                                
                                # Handle VAD signals
                                if hasattr(message, 'type') and message.type == 'events':
                                    signal_type = getattr(message.data, 'signal_type', '')
                                    logger.info(f"[VAD] Signal type: {signal_type}")
                                    if signal_type == 'START_SPEECH':
                                        logger.info("[VAD] Speech started")
                                    elif signal_type == 'END_SPEECH':
                                        logger.info("[VAD] Speech ended")
                                        last_speech_end = asyncio.get_event_loop().time()
                                
                                # Handle transcript data
                                elif hasattr(message, 'type') and message.type == 'data':
                                    logger.info(f"[STT] Data message: {message.data}")
                                    if hasattr(message.data, 'transcript'):
                                        transcript = message.data.transcript.strip()
                                        if transcript:
                                            transcripts.append(transcript)
                                            logger.info(f"[STT] Segment: {transcript}")
                                
                                # Handle error messages
                                elif hasattr(message, 'type') and message.type == 'error':
                                    logger.error(f"[Sarvam STT] Error: {message}")
                                
                                # Handle any other message types
                                else:
                                    logger.info(f"[Sarvam STT] Unknown message type: {message}")
                                
                                # Check if we should stop (after silence timeout)
                                if last_speech_end > 0 and len(transcripts) > 0:
                                    current_time = asyncio.get_event_loop().time()
                                    if current_time - last_speech_end > silence_timeout:
                                        logger.info(f"[VAD] Silence timeout ({silence_timeout}s) - finalizing")
                                        break
                                
                                # Stop after reasonable number of segments
                                if len(transcripts) >= 10:
                                    logger.info("[STT] Max segments reached - finalizing")
                                    break
                            
                            # Check for silence timeout even without new messages
                            elif last_speech_end > 0 and len(transcripts) > 0:
                                current_time = asyncio.get_event_loop().time()
                                if current_time - last_speech_end > silence_timeout:
                                    logger.info(f"[VAD] Silence timeout ({silence_timeout}s) - finalizing")
                                    break
                                    
                        except asyncio.TimeoutError:
                            # Check for silence timeout on each iteration
                            if last_speech_end > 0 and len(transcripts) > 0:
                                current_time = asyncio.get_event_loop().time()
                                if current_time - last_speech_end > silence_timeout:
                                    logger.info(f"[VAD] Silence timeout ({silence_timeout}s) - finalizing")
                                    break
                            
                except Exception as e:
                    logger.warning(f"[STT] Stream error: {e}")
                finally:
                    if timeout_task and not timeout_task.done():
                        timeout_task.cancel()
                    if message_task and not message_task.done():
                        message_task.cancel()
                
                # Combine all transcripts
                final_text = ' '.join(transcripts).strip()
                
                # Log analytics metrics (simplified logging without database)
                try:
                    latency_ms = int((time.time() - start_time) * 1000)
                    audio_duration_sec = len(audio_bytes) / 32000  # Rough estimate
                    logger.info(f"Sarvam STT Streaming - Duration: {audio_duration_sec:.2f}s, Latency: {latency_ms}ms, Language: {language_code}")
                except Exception as log_error:
                    logger.warning(f"Analytics logging failed: {log_error}")
                
                logger.info(f"[Sarvam STT] Final result: '{final_text}'")
                return final_text if final_text else None
                
        except Exception as e:
            logger.error(f"[Sarvam STT] Error: {e}", exc_info=True)
            
            # Log error metrics (simplified logging without database)
            try:
                latency_ms = int((time.time() - start_time) * 1000)
                audio_duration_sec = len(audio_bytes) / 32000
                logger.error(f"Sarvam STT Streaming Error - Duration: {audio_duration_sec:.2f}s, Latency: {latency_ms}ms, Error: {str(e)}")
            except Exception as log_error:
                logger.warning(f"Analytics logging failed: {log_error}")
            
            return None
