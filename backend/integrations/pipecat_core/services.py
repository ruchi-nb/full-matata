"""
Pipecat Service Wrappers for existing STT/LLM/TTS services
These wrap your existing integrations to work with Pipecat's frame-based architecture
"""

import asyncio
import time
import logging
from typing import AsyncIterator, Optional
from dataclasses import dataclass

from pipecat.frames.frames import (
    Frame,
    AudioRawFrame,
    TextFrame,
    TranscriptionFrame,
    TTSAudioRawFrame,
    TTSStartedFrame,
    TTSStoppedFrame,
    LLMMessagesFrame,
    LLMFullResponseStartFrame,
    LLMFullResponseEndFrame,
    StartFrame,
    EndFrame,
    CancelFrame,
    ErrorFrame
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from integrations.unified_services import deepgram_service, sarvam_service, openai_service
from integrations.rag.service import RAGService

logger = logging.getLogger(__name__)


# ==========================================
# STT SERVICE WRAPPERS
# ==========================================

class DeepgramSTTServiceWrapper(FrameProcessor):
    """
    Wraps Deepgram STT to work with Pipecat's frame architecture
    Provides streaming transcription with low latency
    """
    
    def __init__(self, language: str = "en", multilingual: bool = False):
        super().__init__()  # Initialize FrameProcessor
        self.language = language
        self.multilingual = multilingual
        self._deepgram = deepgram_service
        self._audio_buffer = bytearray()
        self._last_transcription_time = 0
        self._transcription_interval = 0.3  # Send interim results every 300ms
        logger.info(f"DeepgramSTTServiceWrapper initialized: lang={language}, multilingual={multilingual}")
    
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Process audio frames and transcribe them"""
        # Handle control frames first
        if isinstance(frame, (StartFrame, EndFrame, CancelFrame)):
            await super().process_frame(frame, direction)
            await self.push_frame(frame, direction)
            return
        
        # Only process audio frames
        if not isinstance(frame, AudioRawFrame):
            await self.push_frame(frame, direction)
            return
        
        audio = frame.audio
        try:
            # Buffer audio for better transcription quality
            self._audio_buffer.extend(audio)
            current_time = time.time()
            
            # Transcribe at intervals to balance latency and accuracy
            if (current_time - self._last_transcription_time) >= self._transcription_interval:
                if len(self._audio_buffer) > 3200:  # At least 100ms of audio at 16kHz
                    audio_data = bytes(self._audio_buffer)
                    self._audio_buffer.clear()
                    self._last_transcription_time = current_time
                    
                    # Use existing Deepgram streaming STT
                    transcript = await self._deepgram.stt_streaming(
                        audio_bytes=audio_data,
                        language_code=self.language,
                        encoding="audio/raw",
                        sample_rate=16000,
                        multilingual=self.multilingual
                    )
                    
                    if transcript:
                        logger.debug(f"Deepgram transcription: {transcript}")
                        await self.push_frame(TranscriptionFrame(transcript, "", current_time), direction)
        
        except Exception as e:
            logger.error(f"Deepgram STT error: {e}")
            await self.push_frame(ErrorFrame(f"STT Error: {str(e)}"), direction)


class SarvamSTTServiceWrapper(FrameProcessor):
    """
    Wraps Sarvam STT to work with Pipecat's frame architecture
    Provides streaming transcription for Indian languages
    """
    
    def __init__(self, language_code: str = "hi-IN"):
        super().__init__()  # Initialize FrameProcessor
        self.language_code = language_code
        self._sarvam = sarvam_service
        self._audio_buffer = bytearray()
        self._last_transcription_time = 0
        self._transcription_interval = 0.4  # Sarvam benefits from slightly larger chunks
        logger.info(f"SarvamSTTServiceWrapper initialized: lang={language_code}")
    
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Process audio frames and transcribe them"""
        # Handle control frames first
        if isinstance(frame, (StartFrame, EndFrame, CancelFrame)):
            await super().process_frame(frame, direction)
            await self.push_frame(frame, direction)
            return
        
        # Only process audio frames
        if not isinstance(frame, AudioRawFrame):
            await self.push_frame(frame, direction)
            return
        
        audio = frame.audio
        try:
            self._audio_buffer.extend(audio)
            current_time = time.time()
            
            # Transcribe at intervals
            if (current_time - self._last_transcription_time) >= self._transcription_interval:
                if len(self._audio_buffer) > 6400:  # ~200ms of audio
                    audio_data = bytes(self._audio_buffer)
                    self._audio_buffer.clear()
                    self._last_transcription_time = current_time
                    
                    # Use existing Sarvam streaming STT
                    transcript = await self._sarvam.speech_to_text_streaming(
                        audio_bytes=audio_data,
                        language_code=self.language_code,
                        silence_timeout=3.0,
                        encoding="audio/wav",
                        sample_rate=16000
                    )
                    
                    if transcript:
                        logger.debug(f"Sarvam transcription: {transcript}")
                        await self.push_frame(TranscriptionFrame(transcript, "", current_time), direction)
        
        except Exception as e:
            logger.error(f"Sarvam STT error: {e}")
            await self.push_frame(ErrorFrame(f"STT Error: {str(e)}"), direction)


# ==========================================
# LLM SERVICE WITH RAG INTEGRATION
# ==========================================

class OpenAIRAGLLMService(FrameProcessor):
    """
    Wraps OpenAI + RAG to work with Pipecat's frame architecture
    Provides streaming LLM responses with RAG context injection
    Maintains conversation history for context-aware responses
    """
    
    def __init__(
        self,
        system_prompt: Optional[str] = None,
        use_rag: bool = True,
        session_id: Optional[str] = None
    ):
        super().__init__()  # Initialize FrameProcessor
        self._openai = openai_service
        self._rag = RAGService() if use_rag else None
        self._system_prompt = system_prompt
        self._use_rag = use_rag
        self._session_id = session_id or f"pipecat-{int(time.time())}"
        
        # Conversation history for maintaining context
        self._conversation_history = []
        
        logger.info(f"OpenAIRAGLLMService initialized: use_rag={use_rag}, session_id={self._session_id}")
    
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Process transcription/text frames and generate LLM responses"""
        # Handle control frames first
        if isinstance(frame, (StartFrame, EndFrame, CancelFrame)):
            # Let parent handle control frames for internal tracking
            await super().process_frame(frame, direction)
            await self.push_frame(frame, direction)
            return
        
        # Process both TranscriptionFrame (from STT) and TextFrame (from user text input)
        if isinstance(frame, TranscriptionFrame):
            user_message = frame.text
            logger.info(f"LLM received TranscriptionFrame: {user_message[:50]}...")
        elif isinstance(frame, TextFrame):
            user_message = frame.text
            logger.info(f"LLM received TextFrame: {user_message[:50]}...")
        else:
            # Pass through other frame types
            await self.push_frame(frame, direction)
            return
        
        # Now process the user message
        # user_message = frame.text  # Removed - already extracted above
        if not user_message or not user_message.strip():
            return
        
        try:
            logger.info(f"💬 LLM: Processing user message (RAG enabled: {self._use_rag})")
            
            # Format prompt to match working implementation (routes_conversation.py)
            formatted_user_message = f"Patient said: {user_message}"
            
            # Build full context with RAG if enabled
            messages = await self._build_messages_with_rag(formatted_user_message)
            
            # Extract prompt
            prompt = messages[-1]["content"] if messages else formatted_user_message
            logger.info(f"🤖 LLM: Generating response with {len(messages)} context messages...")
            
            # Yield LLM start marker
            await self.push_frame(LLMFullResponseStartFrame(), direction)
            
            # Stream LLM response with ultra-low latency parameters
            response_tokens = []
            for token in self._openai.generate_response_stream(
                prompt=prompt,
                max_tokens=150,  # Shorter responses = faster time-to-first-audio
                temperature=0.3,  # Balanced for speed and quality
                top_p=0.85,  # Reduced for faster token generation
                system_prompt=self._system_prompt,
                session_id=self._session_id,  # CRITICAL: Pass session_id for conversation history!
                use_rag=False  # RAG already applied in message building
            ):
                response_tokens.append(token)
                # Yield each token as a text frame for immediate TTS processing
                await self.push_frame(TextFrame(token), direction)
            
            full_response = "".join(response_tokens)
            logger.info(f"✅ LLM: Generated response ({len(full_response)} chars): '{full_response[:100]}...'")
            
            # Add this exchange to conversation history (for context in next turn)
            self._conversation_history.append({"role": "user", "content": user_message})
            self._conversation_history.append({"role": "assistant", "content": full_response})
            
            # Limit history to last 10 messages (5 turns) to prevent context overflow
            if len(self._conversation_history) > 10:
                self._conversation_history = self._conversation_history[-10:]
                logger.debug(f"Trimmed conversation history to last 10 messages")
            
            logger.info(f"📜 Conversation history updated: {len(self._conversation_history)} messages")
            
            # Yield LLM end marker
            await self.push_frame(LLMFullResponseEndFrame(), direction)
        
        except Exception as e:
            logger.error(f"LLM streaming error: {e}")
            await self.push_frame(ErrorFrame(f"LLM Error: {str(e)}"), direction)
    
    async def _build_messages_with_rag(self, user_text: str) -> list:
        """
        Build message list with RAG context and conversation history
        """
        messages = []
        
        # Add system prompt
        if self._system_prompt:
            messages.append({"role": "system", "content": self._system_prompt})
            logger.debug(f"Added system prompt ({len(self._system_prompt)} chars)")
        
        # Add RAG context (only for the current user message, not historical ones)
        if self._use_rag and self._rag:
            try:
                logger.info(f"🔍 RAG: Retrieving context for: '{user_text[:50]}...'")
                # Use RAGService's build_context method (not retrieve)
                rag_context = self._rag.build_context(user_text, k=3)  # Get top 3 chunks
                
                if rag_context and rag_context.strip():
                    logger.info(f"✅ RAG: Retrieved context ({len(rag_context)} chars)")
                    
                    # Add RAG context as system message
                    rag_message = f"Relevant medical knowledge:\n\n{rag_context}\n\nBased on this medical knowledge, please provide an accurate and helpful response."
                    messages.append({"role": "system", "content": rag_message})
                    logger.info(f"✅ RAG: Added {len(rag_context)} chars of context to LLM")
                else:
                    logger.warning("⚠️ RAG: No relevant context found")
                    
            except Exception as e:
                logger.error(f"❌ RAG retrieval failed: {e}", exc_info=True)
                logger.warning("Continuing without RAG context")
        else:
            if not self._use_rag:
                logger.info("RAG is disabled for this request")
            elif not self._rag:
                logger.warning("RAG service not initialized")
        
        # Add conversation history to maintain context
        if self._conversation_history:
            messages.extend(self._conversation_history)
            logger.info(f"📜 Added {len(self._conversation_history)} messages from conversation history")
        
        # Add current user message
        messages.append({"role": "user", "content": user_text})
        logger.debug(f"Built message list with {len(messages)} messages total")
        
        return messages
    


# ==========================================
# TTS SERVICE WRAPPERS
# ==========================================

class DeepgramTTSServiceWrapper(FrameProcessor):
    """
    Wraps Deepgram TTS to work with Pipecat's frame architecture
    Provides streaming audio generation with ultra-low latency
    
    Accumulates tokens into minimal phrases for immediate audio feedback
    """
    
    def __init__(self, voice: str = "aura-asteria-en"):
        super().__init__()  # Initialize FrameProcessor
        self.voice = voice
        self._deepgram = deepgram_service
        
        # Token accumulation for smooth TTS
        self._token_buffer = []
        self._last_token_time = 0
        
        # Reduced lock - client handles queuing
        self._is_processing_tts = False
        self._flush_task = None
        
        logger.info(f"DeepgramTTSServiceWrapper initialized: voice={voice} (ULTRA-LOW LATENCY MODE)")
    
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Process text frames and convert to audio with ultra-low latency"""
        # Handle control frames first
        if isinstance(frame, (StartFrame, EndFrame, CancelFrame)):
            await super().process_frame(frame, direction)
            await self.push_frame(frame, direction)
            
            # Flush any remaining tokens on EndFrame
            if isinstance(frame, EndFrame) and self._token_buffer:
                if self._flush_task:
                    self._flush_task.cancel()
                await self._flush_tokens_deepgram(direction)
            
            return
        
        # Handle LLM response end markers
        if isinstance(frame, LLMFullResponseEndFrame):
            # Flush accumulated tokens when LLM finishes
            if self._flush_task:
                self._flush_task.cancel()
            if self._token_buffer:
                await self._flush_tokens_deepgram(direction)
            await self.push_frame(frame, direction)
            return
        
        # Only process text frames from LLM
        if not isinstance(frame, TextFrame):
            await self.push_frame(frame, direction)
            return
        
        text = frame.text
        if not text or not text.strip():
            return
        
        try:
            # ✨ IMPORTANT: Forward text immediately to frontend (user sees it instantly)
            await self.push_frame(frame, direction)
            
            # Accumulate token in buffer
            self._token_buffer.append(text)
            self._last_token_time = asyncio.get_event_loop().time()
            
            # Check if we should flush (create audio) based on accumulated text
            should_flush = False
            accumulated_text = "".join(self._token_buffer)
            buffer_len = len(self._token_buffer)
            text_len = len(accumulated_text)
            
            # 🚀 ULTRA-LOW LATENCY STRATEGY: Flush very aggressively
            
            # 1. IMMEDIATE flush on sentence boundaries (., !, ?)
            if text.strip() in ['.', '!', '?'] or text.endswith(('.', '!', '?')):
                should_flush = True
                logger.info(f"🔊 TTS: Sentence end ({buffer_len} tokens, {text_len} chars)")
            
            # 2. Flush on comma with just 3+ tokens (was 8+)
            elif text.strip() in [',', ';'] and buffer_len >= 3:
                should_flush = True
                logger.info(f"🔊 TTS: Comma phrase ({buffer_len} tokens, {text_len} chars)")
            
            # 3. Flush on colon/question immediately (questions need fast response)
            elif text.strip() in [':', '?']:
                should_flush = True
                logger.info(f"🔊 TTS: Punctuation ({buffer_len} tokens)")
            
            # 4. Flush when we have a decent chunk (5+ tokens or 20+ chars)
            elif buffer_len >= 5 or text_len >= 20:
                should_flush = True
                logger.info(f"🔊 TTS: Chunk ready ({buffer_len} tokens, {text_len} chars)")
            
            if should_flush:
                # Cancel any pending flush task
                if self._flush_task:
                    self._flush_task.cancel()
                # Flush immediately (no lock - client handles queuing)
                await self._flush_tokens_deepgram(direction)
            else:
                # Set up auto-flush after 150ms of no new tokens (time-based flushing)
                if self._flush_task:
                    self._flush_task.cancel()
                self._flush_task = asyncio.create_task(self._auto_flush_after_delay(direction, 0.15))
        
        except Exception as e:
            logger.error(f"Deepgram TTS error: {e}")
            await self.push_frame(ErrorFrame(f"TTS Error: {str(e)}"), direction)
    
    async def _auto_flush_after_delay(self, direction: FrameDirection, delay: float):
        """Auto-flush buffer if no new tokens arrive within delay"""
        try:
            await asyncio.sleep(delay)
            # If we're still here after delay, flush the buffer
            if self._token_buffer:
                logger.info(f"⏰ TTS: Auto-flushing after {delay}s silence ({len(self._token_buffer)} tokens)")
                await self._flush_tokens_deepgram(direction)
        except asyncio.CancelledError:
            # Task was cancelled because new token arrived - this is normal
            pass
    
    async def _flush_tokens_deepgram(self, direction: FrameDirection):
        """Flush accumulated tokens and generate audio immediately (no lock - client handles queuing)"""
        if not self._token_buffer or self._is_processing_tts:
            return
        
        # Combine all tokens into a phrase
        text = "".join(self._token_buffer).strip()
        self._token_buffer.clear()  # Clear buffer immediately to accept new tokens
        
        if not text:
            return
        
        # NO LOCK - Let client handle audio queuing for smoother experience
        logger.info(f"🔊 TTS: [START] '{text[:60]}...' ({len(text)} chars)")
        
        try:
            self._is_processing_tts = True
            
            # Signal TTS started
            await self.push_frame(TTSStartedFrame(), direction)
            
            # Generate audio for the accumulated phrase
            chunk_count = 0
            async for audio_chunk in self._deepgram.tts_streaming(
                text=text,
                voice=self.voice,
                encoding="linear16"
            ):
                if audio_chunk:
                    chunk_count += 1
                    # Yield audio frame immediately
                    await self.push_frame(TTSAudioRawFrame(
                        audio=audio_chunk,
                        sample_rate=16000,
                        num_channels=1
                    ), direction)
            
            # Signal TTS stopped
            await self.push_frame(TTSStoppedFrame(), direction)
            logger.info(f"✅ TTS: [DONE] {chunk_count} chunks for: '{text[:30]}...'")
            
            # Small delay between audio segments to prevent overlap on client
            await asyncio.sleep(0.2)  # 200ms gap
        
        except Exception as e:
            logger.error(f"❌ TTS flush error: {e}")
            await self.push_frame(ErrorFrame(f"TTS Error: {str(e)}"), direction)
        
        finally:
            self._is_processing_tts = False


class SarvamTTSServiceWrapper(FrameProcessor):
    """
    Wraps Sarvam TTS to work with Pipecat's frame architecture
    Provides streaming audio generation for Indian languages
    
    Accumulates tokens into minimal phrases for immediate audio feedback
    """
    
    def __init__(self, language: str = "hi-IN", speaker: str = "karun"):
        super().__init__()  # Initialize FrameProcessor
        self.language = language
        self.speaker = speaker
        self._sarvam = sarvam_service
        
        # Token accumulation for smooth TTS
        self._token_buffer = []
        self._last_token_time = 0
        self._flush_task = None
        
        # Reduced lock - client handles queuing
        self._is_processing_tts = False
        
        logger.info(f"SarvamTTSServiceWrapper initialized: lang={language}, speaker={speaker} (ULTRA-LOW LATENCY MODE)")
    
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Process text frames and convert to audio with ultra-low latency"""
        # Handle control frames first
        if isinstance(frame, (StartFrame, EndFrame, CancelFrame)):
            await super().process_frame(frame, direction)
            await self.push_frame(frame, direction)
            
            # Flush any remaining tokens on EndFrame
            if isinstance(frame, EndFrame) and self._token_buffer:
                if self._flush_task:
                    self._flush_task.cancel()
                await self._flush_tokens(direction)
            
            return
        
        # Handle LLM response end markers
        if isinstance(frame, LLMFullResponseEndFrame):
            # Flush accumulated tokens when LLM finishes
            if self._flush_task:
                self._flush_task.cancel()
            if self._token_buffer:
                await self._flush_tokens(direction)
            await self.push_frame(frame, direction)
            return
        
        # Only process text frames from LLM
        if not isinstance(frame, TextFrame):
            await self.push_frame(frame, direction)
            return
        
        text = frame.text
        if not text or not text.strip():
            return
        
        try:
            # ✨ IMPORTANT: Forward text immediately to frontend (user sees it instantly)
            await self.push_frame(frame, direction)
            
            # Accumulate token in buffer
            self._token_buffer.append(text)
            self._last_token_time = asyncio.get_event_loop().time()
            
            # Check if we should flush (create audio) based on accumulated text
            should_flush = False
            accumulated_text = "".join(self._token_buffer)
            buffer_len = len(self._token_buffer)
            text_len = len(accumulated_text)
            
            # 🚀 ULTRA-LOW LATENCY STRATEGY: Flush very aggressively
            
            # 1. IMMEDIATE flush on sentence boundaries (., !, ?)
            if text.strip() in ['.', '!', '?'] or text.endswith(('.', '!', '?')):
                should_flush = True
                logger.info(f"🔊 TTS: Sentence end ({buffer_len} tokens, {text_len} chars)")
            
            # 2. Flush on comma with just 3+ tokens (was 8+)
            elif text.strip() in [',', ';'] and buffer_len >= 3:
                should_flush = True
                logger.info(f"🔊 TTS: Comma phrase ({buffer_len} tokens, {text_len} chars)")
            
            # 3. Flush on colon/question immediately (questions need fast response)
            elif text.strip() in [':', '?']:
                should_flush = True
                logger.info(f"🔊 TTS: Punctuation ({buffer_len} tokens)")
            
            # 4. Flush when we have a decent chunk (5+ tokens or 20+ chars)
            elif buffer_len >= 5 or text_len >= 20:
                should_flush = True
                logger.info(f"🔊 TTS: Chunk ready ({buffer_len} tokens, {text_len} chars)")
            
            if should_flush:
                # Cancel any pending flush task
                if self._flush_task:
                    self._flush_task.cancel()
                # Flush immediately (no lock - client handles queuing)
                await self._flush_tokens(direction)
            else:
                # Set up auto-flush after 200ms of no new tokens (Sarvam needs slightly more)
                if self._flush_task:
                    self._flush_task.cancel()
                self._flush_task = asyncio.create_task(self._auto_flush_after_delay(direction, 0.2))
        
        except Exception as e:
            logger.error(f"Sarvam TTS error: {e}")
            await self.push_frame(ErrorFrame(f"TTS Error: {str(e)}"), direction)
    
    async def _auto_flush_after_delay(self, direction: FrameDirection, delay: float):
        """Auto-flush buffer if no new tokens arrive within delay"""
        try:
            await asyncio.sleep(delay)
            # If we're still here after delay, flush the buffer
            if self._token_buffer:
                logger.info(f"⏰ TTS: Auto-flushing after {delay}s silence ({len(self._token_buffer)} tokens)")
                await self._flush_tokens(direction)
        except asyncio.CancelledError:
            # Task was cancelled because new token arrived - this is normal
            pass
    
    async def _flush_tokens(self, direction: FrameDirection):
        """Flush accumulated tokens and generate audio immediately (no lock - client handles queuing)"""
        if not self._token_buffer or self._is_processing_tts:
            return
        
        # Combine all tokens into a phrase
        text = "".join(self._token_buffer).strip()
        self._token_buffer.clear()  # Clear buffer immediately to accept new tokens
        
        if not text:
            return
        
        # NO LOCK - Let client handle audio queuing for smoother experience
        logger.info(f"🔊 TTS: [START] '{text[:60]}...' ({len(text)} chars)")
        
        try:
            self._is_processing_tts = True
            
            # Signal TTS started
            await self.push_frame(TTSStartedFrame(), direction)
            
            # Generate audio for the accumulated phrase
            chunk_count = 0
            async for audio_chunk in self._sarvam.text_to_speech_streaming_chunks(
                text=text,
                language=self.language,
                speaker=self.speaker
            ):
                if audio_chunk:
                    chunk_count += 1
                    # Yield audio frame immediately
                    await self.push_frame(TTSAudioRawFrame(
                        audio=audio_chunk,
                        sample_rate=16000,
                        num_channels=1
                    ), direction)
            
            # Signal TTS stopped
            await self.push_frame(TTSStoppedFrame(), direction)
            logger.info(f"✅ TTS: [DONE] {chunk_count} chunks for: '{text[:30]}...'")
            
            # Small delay between audio segments to prevent overlap on client
            await asyncio.sleep(0.2)  # 200ms gap
        
        except Exception as e:
            logger.error(f"❌ TTS flush error: {e}")
            await self.push_frame(ErrorFrame(f"TTS Error: {str(e)}"), direction)
        
        finally:
            self._is_processing_tts = False


# ==========================================
# ANALYTICS OBSERVER
# ==========================================

class AnalyticsObserver(FrameProcessor):
    """
    Observes all frames flowing through the pipeline for analytics
    Non-blocking logging to your database
    """
    
    def __init__(
        self,
        consultation_id: Optional[int] = None,
        session_db_id: Optional[int] = None,
        doctor_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        hospital_id: Optional[int] = None,
        **kwargs
    ):
        # Initialize FrameProcessor first
        super().__init__()
        
        # Store analytics metadata
        self.consultation_id = consultation_id
        self.session_db_id = session_db_id
        self.doctor_id = doctor_id
        self.patient_id = patient_id
        self.hospital_id = hospital_id
        
        # Timing trackers
        self._stt_start = None
        self._llm_start = None
        self._tts_start = None
        
        # Content trackers
        self._current_transcript = ""
        self._current_response = ""
        
        logger.info(f"AnalyticsObserver initialized: consultation_id={consultation_id}")
    
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """
        Observe frames and log analytics without blocking the pipeline
        """
        # Let parent FrameProcessor handle the frame first (for internal tracking)
        await super().process_frame(frame, direction)
        
        # Pass through special control frames immediately
        if isinstance(frame, (StartFrame, EndFrame, CancelFrame)):
            await self.push_frame(frame, direction)
            return
        
        # Start timing for different stages
        if isinstance(frame, AudioRawFrame) and self._stt_start is None:
            self._stt_start = time.time()
        
        elif isinstance(frame, TranscriptionFrame):
            self._current_transcript = frame.text
            if self._stt_start:
                stt_latency = int((time.time() - self._stt_start) * 1000)
                # Fire-and-forget logging
                asyncio.create_task(self._log_stt_analytics(frame.text, stt_latency))
            self._llm_start = time.time()
        
        elif isinstance(frame, TextFrame):
            self._current_response += frame.text
        
        elif isinstance(frame, TTSStartedFrame):
            self._tts_start = time.time()
            if self._llm_start:
                llm_latency = int((time.time() - self._llm_start) * 1000)
                # Fire-and-forget logging
                asyncio.create_task(self._log_llm_analytics(self._current_response, llm_latency))
        
        elif isinstance(frame, TTSStoppedFrame):
            if self._tts_start:
                tts_latency = int((time.time() - self._tts_start) * 1000)
                # Fire-and-forget logging
                asyncio.create_task(self._log_tts_analytics(self._current_response, tts_latency))
            
            # Reset for next turn
            self._stt_start = None
            self._llm_start = None
            self._tts_start = None
            self._current_transcript = ""
            self._current_response = ""
        
        # Always pass through the frame downstream
        await self.push_frame(frame, direction)
    
    async def _log_stt_analytics(self, transcript: str, latency_ms: int):
        """
        Log STT analytics to database (non-blocking)
        """
        try:
            if self.session_db_id and self.consultation_id:
                from database.database import AsyncSessionLocal
                from service.analytics_service import log_deepgram_stt, log_sarvam_stt
                
                async with AsyncSessionLocal() as db:
                    # Determine provider and log accordingly
                    # You can track provider in init or determine from service type
                    await log_deepgram_stt(
                        db=db,
                        audio_duration_sec=0,  # Calculate from audio frames if needed
                        response_time_ms=latency_ms,
                        transcript=transcript,
                        status="success",
                        session_id=self.session_db_id,
                        doctor_id=self.doctor_id,
                        patient_id=self.patient_id,
                        hospital_id=self.hospital_id
                    )
        except Exception as e:
            logger.warning(f"STT analytics logging failed: {e}")
    
    async def _log_llm_analytics(self, response: str, latency_ms: int):
        """
        Log LLM analytics to database (non-blocking)
        """
        try:
            if self.session_db_id and self.consultation_id:
                from database.database import AsyncSessionLocal
                from service.analytics_service import log_openai_chat
                
                async with AsyncSessionLocal() as db:
                    await log_openai_chat(
                        db=db,
                        input_tokens=len(self._current_transcript.split()),
                        output_tokens=len(response.split()),
                        response_time_ms=latency_ms,
                        status="success",
                        session_id=self.session_db_id,
                        doctor_id=self.doctor_id,
                        patient_id=self.patient_id,
                        hospital_id=self.hospital_id
                    )
        except Exception as e:
            logger.warning(f"LLM analytics logging failed: {e}")
    
    async def _log_tts_analytics(self, text: str, latency_ms: int):
        """
        Log TTS analytics to database (non-blocking)
        """
        try:
            if self.session_db_id and self.consultation_id:
                from database.database import AsyncSessionLocal
                from service.analytics_service import log_deepgram_tts, log_sarvam_tts
                
                async with AsyncSessionLocal() as db:
                    # Log TTS
                    await log_deepgram_tts(
                        db=db,
                        text_length=len(text),
                        audio_size=0,  # Calculate from audio frames if needed
                        response_time_ms=latency_ms,
                        session_id=self.session_db_id,
                        doctor_id=self.doctor_id,
                        patient_id=self.patient_id,
                        hospital_id=self.hospital_id
                    )
        except Exception as e:
            logger.warning(f"TTS analytics logging failed: {e}")

