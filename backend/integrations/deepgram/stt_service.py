"""
Deepgram STT Service
Handles speech-to-text functionality
"""

import logging
import time
from typing import Optional
import asyncio
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from config import settings
# Analytics integration removed - logging handled at service layer

logger = logging.getLogger(__name__)


class DeepgramSTTService:
    def __init__(self) -> None:
        self.api_key = settings.DEEPGRAM_API_KEY
        self.base_url = settings.DEEPGRAM_BASE_URL
        self.headers_audio = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "audio/wav",
        }
        
        # Configure session with retry strategy
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

    def stt(self, wav_bytes: bytes, language: str = "en", request_id: str = None, session_id: str = None, multilingual: bool = False) -> Optional[str]:
        start_time = time.time()
        request_id = request_id or f"stt-{int(time.time()*1000)}"
        
        try:
            # Use detect_language=true for multilingual code-switching
            if multilingual or (language or "").lower() in ["multi", "auto", "und", ""]:
                url = f"{self.base_url}/listen?model={settings.DEEPGRAM_STT_MODEL}&punctuate=true&smart_format=true&detect_language=true"
            else:
                url = f"{self.base_url}/listen?model={settings.DEEPGRAM_STT_MODEL}&punctuate=true&smart_format=true&language={language}"
            resp = self.session.post(url, headers=self.headers_audio, data=wav_bytes, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            # Debug raw response logging (disabled per user request)
            # try:
            #     import os, json
            #     os.makedirs('logs', exist_ok=True)
            #     with open(os.path.join('logs', 'deepgram_raw.log'), 'a', encoding='utf-8') as f:
            #         f.write(json.dumps({
            #             'timestamp': int(time.time()*1000),
            #             'endpoint': 'stt',
            #             'language': language,
            #             'response': data
            #         }, ensure_ascii=False) + "\n")
            # except Exception:
            #     pass
            # Extract best transcript
            transcript = (
                data.get("results", {})
                .get("channels", [{}])[0]
                .get("alternatives", [{}])[0]
                .get("transcript", "")
            )
            
            # Calculate latency and estimate audio duration
            latency_ms = int((time.time() - start_time) * 1000)
            audio_duration_sec = len(wav_bytes) / 32000  # Rough estimate for 16kHz audio
            
            # Log metrics (simplified logging without database for sync function)
            try:
                logger.info(f"Deepgram STT - Duration: {audio_duration_sec:.2f}s, Latency: {latency_ms}ms, Language: {language}")
            except Exception as log_error:
                logger.warning(f"Analytics logging failed: {log_error}")
            
            return transcript or None
        except Exception as e:  # pragma: no cover
            logger.error(f"Deepgram STT error: {e}")
            
            # Log error metrics (simplified logging without database)
            try:
                latency_ms = int((time.time() - start_time) * 1000)
                audio_duration_sec = len(wav_bytes) / 32000
                logger.error(f"Deepgram STT Error - Duration: {audio_duration_sec:.2f}s, Latency: {latency_ms}ms, Error: {str(e)}")
            except Exception as log_error:
                logger.warning(f"Analytics logging failed: {log_error}")
            
            return None

    def stt_diarize(self, wav_bytes: bytes, language: str = "en", request_id: str = None, session_id: str = None, expected_speakers: Optional[int] = None, diarize_version: str = "2", multilingual: bool = False):
        """Run Deepgram STT with speaker diarization and return transcript plus speaker-labeled utterances.

        Returns a dict: { 'transcript': str, 'utterances': [ { 'speaker': int, 'start': float, 'end': float, 'text': str } ] }
        """
        start_time = time.time()
        request_id = request_id or f"stt-{int(time.time()*1000)}"
        try:
            # Enable diarization with newer diarization engine and better segmentation
            # paragraphs=true often improves turn segmentation; diarize_version=2 enables improved diarization
            # Use detect_language=true for Hindi-English mixed language detection
            if multilingual or (language or "").lower() in ["multi", "auto", "und", ""]:
                url = f"{self.base_url}/listen?model={settings.DEEPGRAM_STT_MODEL}&punctuate=true&smart_format=true&diarize=true&utterances=true&paragraphs=true&diarize_version={diarize_version}&detect_language=true"
            else:
                url = f"{self.base_url}/listen?model={settings.DEEPGRAM_STT_MODEL}&punctuate=true&smart_format=true&diarize=true&utterances=true&paragraphs=true&diarize_version={diarize_version}&language={language}"
            # Auto-detect speakers by default; do not include diarize_speaker_count unless explicitly requested
            if expected_speakers and expected_speakers > 0:
                # Keeping this conditional path, but callers will not pass it unless needed
                url += f"&diarize_speaker_count={expected_speakers}"
            resp = self.session.post(url, headers=self.headers_audio, data=wav_bytes, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            # Best overall transcript
            transcript = (
                data.get("results", {})
                .get("channels", [{}])[0]
                .get("alternatives", [{}])[0]
                .get("transcript", "")
            )
            # Utterances with speakers (if provided)
            utterances = []
            for utt in data.get("results", {}).get("utterances", []) or []:
                utterances.append({
                    'speaker': utt.get('speaker', 0),
                    'start': utt.get('start', 0.0),
                    'end': utt.get('end', 0.0),
                    'text': utt.get('transcript') or utt.get('text') or ''
                })

            # Analytics (simplified logging without database)
            try:
                latency_ms = int((time.time() - start_time) * 1000)
                audio_duration_sec = len(wav_bytes) / 32000
                logger.info(f"Deepgram STT Diarize - Duration: {audio_duration_sec:.2f}s, Latency: {latency_ms}ms, Language: {language}")
            except Exception as log_error:
                logger.warning(f"Analytics logging failed: {log_error}")
            return { 'transcript': transcript, 'utterances': utterances }
        except Exception as e:  # pragma: no cover
            logger.error(f"Deepgram STT(diarize) error: {e}")
            # Log error metrics (simplified logging without database)
            try:
                latency_ms = int((time.time() - start_time) * 1000)
                audio_duration_sec = len(wav_bytes) / 32000
                logger.error(f"Deepgram STT Diarize Error - Duration: {audio_duration_sec:.2f}s, Latency: {latency_ms}ms, Error: {str(e)}")
            except Exception as log_error:
                logger.warning(f"Analytics logging failed: {log_error}")
            return { 'transcript': '', 'utterances': [] }

    def stt_auto(self, audio_bytes: bytes, content_type: str, language: str = "en", multilingual: bool = False) -> Optional[str]:
        try:
            # Let Deepgram infer encoding from content-type (e.g. audio/webm;codecs=opus)
            # Use 'multi' for multilingual code-switching, otherwise use specified language
            lang_lower = (language or "").lower()
            if multilingual or lang_lower in ["multi", "auto", "und", ""]:
                url = f"{self.base_url}/listen?model={settings.DEEPGRAM_STT_MODEL}&punctuate=true&smart_format=true&detect_language=true"
            else:
                url = f"{self.base_url}/listen?model={settings.DEEPGRAM_STT_MODEL}&punctuate=true&smart_format=true&language={language}"
            headers = {"Authorization": f"Token {self.api_key}", "Content-Type": content_type}
            resp = self.session.post(url, headers=headers, data=audio_bytes, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            transcript = (
                data.get("results", {})
                .get("channels", [{}])[0]
                .get("alternatives", [{}])[0]
                .get("transcript", "")
            )
            return transcript or None
        except Exception as e:  # pragma: no cover
            logger.error(f"Deepgram STT(auto) error: {e}")
            return None

    def _wrap_pcm16_to_wav(self, pcm_bytes: bytes, sample_rate: int = 16000) -> bytes:
        """Wrap raw PCM16 mono data in a minimal WAV header so Deepgram WAV endpoint accepts it."""
        import struct
        num_channels = 1
        bits_per_sample = 16
        byte_rate = sample_rate * num_channels * bits_per_sample // 8
        block_align = num_channels * bits_per_sample // 8
        data_size = len(pcm_bytes)
        riff_chunk_size = 36 + data_size
        wav_header = (
            b'RIFF' + struct.pack('<I', riff_chunk_size) + b'WAVE' +
            b'fmt ' + struct.pack('<I', 16) + struct.pack('<H', 1) +
            struct.pack('<H', num_channels) + struct.pack('<I', sample_rate) +
            struct.pack('<I', byte_rate) + struct.pack('<H', block_align) + struct.pack('<H', bits_per_sample) +
            b'data' + struct.pack('<I', data_size)
        )
        return wav_header + pcm_bytes

    async def stt_streaming(
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
        session_id: str = None,
        multilingual: bool = False
    ) -> Optional[str]:
        """
        Pseudo-streaming STT that mirrors Sarvam's interface while using Deepgram's
        synchronous WAV endpoint under the hood. Supports PCM16 and WAV inputs.

        - If encoding == 'pcm', wraps PCM16 mono into a minimal WAV container
        - Calls the existing stt() path and returns the final transcript
        - Logs analytics with the same schema used elsewhere

        Note: VAD-related parameters are accepted for API parity but are not used
        by the synchronous Deepgram path.

        Example usage:

            transcript = await deepgram_service.stt_streaming(
                audio_bytes=wav_bytes,
                language_code="en-US",
                encoding="audio/wav",
                sample_rate=16000
            )
            # Returns simple transcript string
        """
        start_time = time.time()
        request_id = request_id or f"stt-{int(time.time()*1000)}"
        language = (language_code or "en").split("-")[0]

        try:
            # Prepare WAV bytes depending on encoding
            if encoding == 'pcm':
                wav_bytes = self._wrap_pcm16_to_wav(audio_bytes, sample_rate=sample_rate)
            else:
                # Assume already WAV-compatible
                wav_bytes = audio_bytes

            # Use basic STT implementation (no diarization)
            transcript = self.stt(
                wav_bytes=wav_bytes,
                language=language,
                request_id=request_id,
                session_id=session_id,
                multilingual=multilingual
            )

            # For API parity, apply a basic silence timeout behavior (noop here)
            # We keep the parameter for compatibility with Sarvam usage.

            return transcript

        except Exception as e:
            # Mirror error logging from stt()
            try:
                latency_ms = int((time.time() - start_time) * 1000)
                audio_duration_sec = len(audio_bytes) / 32000
                logger.error(f"Deepgram STT Streaming Error - Duration: {audio_duration_sec:.2f}s, Latency: {latency_ms}ms, Error: {str(e)}")
            except Exception as log_error:
                logger.warning(f"Analytics logging failed: {log_error}")
            logger.error(f"Deepgram STT(streaming) error: {e}")
            return None
