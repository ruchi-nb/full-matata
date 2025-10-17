"""
Unified Services
Combines all separated services for backward compatibility
"""

from .sarvam import SarvamSTTService, SarvamTTSService, SarvamTranslationService
from database.redis import SessionManager
from .deepgram import DeepgramSTTService, DeepgramTTSService


class UnifiedSarvamService:
    """Unified Sarvam service that combines STT, TTS, and Translation"""
    
    def __init__(self):
        self.stt_service = SarvamSTTService()
        self.tts_service = SarvamTTSService()
        self.translation_service = SarvamTranslationService()
        
        # Expose common methods for backward compatibility
        self.api_key = self.stt_service.api_key
        self._convert_lang_code = self.stt_service._convert_lang_code
    
    # STT Methods
    def speech_to_text(self, audio_file_path: str, language: str = "hi", request_id: str = None, session_id: str = None):
        return self.stt_service.speech_to_text(audio_file_path, language, request_id, session_id)
    
    async def speech_to_text_streaming(self, audio_bytes: bytes, language_code: str = None, model: str = None, 
                                     high_vad_sensitivity: bool = True, vad_signals: bool = True, 
                                     encoding: str = "audio/wav", sample_rate: int = 16000, 
                                     flush: bool = False, silence_timeout: float = 3.0, 
                                     request_id: str = None, session_id: str = None):
        return await self.stt_service.speech_to_text_streaming(
            audio_bytes, language_code, model, high_vad_sensitivity, vad_signals, 
            encoding, sample_rate, flush, silence_timeout, request_id, session_id
        )
    
    # TTS Methods
    async def get_tts_audio_content(self, text: str, language: str = "hi-IN", speaker: str = "karun"):
        return await self.tts_service.get_tts_audio_content(text, language, speaker)
    
    async def text_to_speech_streaming(self, text: str, language: str = "hi-IN", speaker: str = "karun", 
                                     request_id: str = None, session_id: str = None):
        return await self.tts_service.text_to_speech_streaming(text, language, speaker, request_id, session_id)
    
    async def text_to_speech_streaming_chunks(self, text: str, language: str = "hi-IN", speaker: str = "karun"):
        async for chunk in self.tts_service.text_to_speech_streaming_chunks(text, language, speaker):
            yield chunk
    
    async def text_to_speech(self, text: str, language: str = "hi-IN", speaker: str = "karun"):
        return await self.tts_service.text_to_speech(text, language, speaker)
    
    # Translation Methods
    def speech_translate(self, audio_file_path: str, source_lang: str = "hi", target_lang: str = "en"):
        return self.translation_service.speech_translate(audio_file_path, source_lang, target_lang)
    
    def text_translate(self, text: str, source_lang: str = "en", target_lang: str = "hi", 
                      request_id: str = None, session_id: str = None):
        return self.translation_service.text_translate(text, source_lang, target_lang, request_id, session_id)





class UnifiedDeepgramService:
    """Unified Deepgram service that combines STT and TTS"""
    
    def __init__(self):
        self.stt_service = DeepgramSTTService()
        self.tts_service = DeepgramTTSService()
        
        # Expose common properties for backward compatibility
        self.api_key = self.stt_service.api_key
        self.base_url = self.stt_service.base_url
        self.headers_audio = self.stt_service.headers_audio
        self.session = self.stt_service.session
        
        # Create headers_json for backward compatibility (manually construct it)
        self.headers_json = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "application/json",
        }
    
    # STT Methods
    def stt(self, wav_bytes: bytes, language: str = "en", request_id: str = None, session_id: str = None, multilingual: bool = False):
        return self.stt_service.stt(wav_bytes, language, request_id, session_id, multilingual)
    
    def stt_auto(self, audio_bytes: bytes, content_type: str, language: str = "en", multilingual: bool = False):
        return self.stt_service.stt_auto(audio_bytes, content_type, language, multilingual)
    
    async def stt_streaming(self, audio_bytes: bytes, language_code: str = None, model: str = None, 
                           high_vad_sensitivity: bool = True, vad_signals: bool = True, 
                           encoding: str = "audio/wav", sample_rate: int = 16000, 
                           flush: bool = False, silence_timeout: float = 3.0, 
                           request_id: str = None, session_id: str = None, multilingual: bool = False):
        return await self.stt_service.stt_streaming(
            audio_bytes, language_code, model, high_vad_sensitivity, vad_signals, 
            encoding, sample_rate, flush, silence_timeout, request_id, session_id, multilingual
        )
    
    def stt_diarize(self, wav_bytes: bytes, language: str = "en", request_id: str = None, session_id: str = None, expected_speakers: int = None, diarize_version: str = "2", multilingual: bool = False):
        return self.stt_service.stt_diarize(wav_bytes, language, request_id, session_id, expected_speakers, diarize_version, multilingual)
    
    # TTS Methods
    async def tts(self, text: str, voice: str = None, encoding: str = "linear16", request_id: str = None):
        """Non-streaming TTS (batch mode)"""
        return await self.tts_service.tts_batch(text, voice, encoding, request_id)
    
    async def tts_streaming(self, text: str, voice: str = None, encoding: str = "mp3", request_id: str = None):
        """Streaming TTS (production-grade)"""
        async for chunk in self.tts_service.tts_streaming(text, voice, encoding, request_id):
            yield chunk


# Import enhanced OpenAI service with production optimizations
from .openai.chat_service import OpenAIChatService
openai_service = OpenAIChatService()

# Create optimized singleton instances for backward compatibility
sarvam_service = UnifiedSarvamService()
deepgram_service = UnifiedDeepgramService()
