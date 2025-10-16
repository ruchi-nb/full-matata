"""
Sarvam Translation Service (UNUSED)
Handles text translation functionality - Currently not used in any routes
"""

import logging
import time
import requests
from typing import Optional
# Analytics integration removed - logging handled at service layer
from config import settings
# Analytics logging handled at service layer

logger = logging.getLogger(__name__)


class SarvamTranslationService:
    def __init__(self):
        self.api_key = settings.SARVAM_API_KEY
        self.base_url = settings.SARVAM_BASE_URL
        self.headers = {
            "Content-Type": "application/json",
            "api-subscription-key": self.api_key
        }

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
                response = requests.post(url, files=files, data=data, headers=headers)
            response.raise_for_status()

            result = response.json()
            transcribed_text = result.get('transcript', '')

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

    def text_translate(self, text: str, source_lang: str = "en", target_lang: str = "hi", 
                      request_id: str = None, session_id: str = None) -> Optional[str]:
        """Translate text from source to target language"""
        start_time = time.time()
        request_id = request_id or f"trans-{int(time.time()*1000)}"
        
        try:
            print(f"TRANSLATE REQUEST: '{text}' from {source_lang} to {target_lang}")
            
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

            response = requests.post(url, json=payload, headers=self.headers)
            if response.status_code != 200:
                logger.error(f"Sarvam API error: {response.status_code} - {response.text}")
                return text

            result = response.json()
            translated = result.get('translated_text', text)
            print(f"TRANSLATE RESULT: '{translated}'")
            # Heuristic: if translation unexpectedly balloons (possible paraphrase), retry once with ultra-strict options
            try:
                if source_lang != target_lang:
                    if len(text) > 0 and len(translated) > max(512, 3 * len(text)):
                        logger.warning("Translation length anomaly detected; retrying with stricter options")
                        strict_payload = {
                            "input": text,
                            "source_language_code": source_lang_converted,
                            "target_language_code": target_lang_converted,
                            "mode": "formal",
                            "model": settings.SARVAM_TRANSLATE_MODEL,
                            "enable_preprocessing": False
                        }
                        strict_resp = requests.post(url, json=strict_payload, headers=self.headers)
                        if strict_resp.status_code == 200:
                            strict_result = strict_resp.json()
                            strict_translated = strict_result.get('translated_text') or translated
                            if len(strict_translated) <= len(translated):
                                translated = strict_translated
            except Exception:
                # Non-fatal; keep first translation
                pass
            if not translated or translated.strip() == "":
                logger.warning("Empty translation received, returning original text")
                translated = text

            try:
                latency_ms = int((time.time() - start_time) * 1000)
                logger.info(f"Sarvam Translation - Input: {len(text)} chars, Output: {len(translated)} chars, Latency: {latency_ms}ms, {source_lang_converted}->{target_lang_converted}")
                
                # Note: Translation logging would need database session
                # Simplified logging for now
                logger.info(f"Translation completed: {source_lang_converted} -> {target_lang_converted}")
            except Exception as log_error:
                logger.warning(f"Translation logging failed: {log_error}")

            return translated

        except Exception as e:
            logger.error(f"Text translation error: {str(e)}")
            
            # Log error metrics (simplified logging without database)
            try:
                latency_ms = int((time.time() - start_time) * 1000)
                logger.error(f"Sarvam Translation Error - Input: {len(text)} chars, Latency: {latency_ms}ms, Error: {str(e)}")
            except Exception as log_error:
                logger.warning(f"Analytics logging failed: {log_error}")
            
            return text
