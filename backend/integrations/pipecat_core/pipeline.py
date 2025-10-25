"""
Pipecat Pipeline Builder
Orchestrates STT → LLM+RAG → TTS pipeline with optimal streaming
"""

import logging
import asyncio
from typing import Optional
from dataclasses import dataclass

from fastapi import WebSocketDisconnect
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask, PipelineParams
from pipecat.processors.frame_processor import FrameDirection

from .services import (
    DeepgramSTTServiceWrapper,
    SarvamSTTServiceWrapper,
    OpenAIRAGLLMService,
    DeepgramTTSServiceWrapper,
    SarvamTTSServiceWrapper,
    AnalyticsObserver
)

logger = logging.getLogger(__name__)


@dataclass
class PipelineConfig:
    """Configuration for pipeline services"""
    # STT Configuration
    stt_provider: str = "deepgram"  # "deepgram" or "sarvam"
    stt_language: str = "en"
    stt_multilingual: bool = False
    
    # LLM Configuration
    llm_system_prompt: Optional[str] = None
    llm_use_rag: bool = True
    
    # TTS Configuration
    tts_provider: str = "deepgram"  # "deepgram" or "sarvam"
    tts_voice: str = "aura-asteria-en"
    tts_language: str = "en-IN"
    tts_speaker: str = "karun"
    
    # Analytics Configuration
    consultation_id: Optional[int] = None
    session_db_id: Optional[int] = None
    session_id: Optional[str] = None  # Session ID for conversation history
    doctor_id: Optional[int] = None
    patient_id: Optional[int] = None
    hospital_id: Optional[int] = None
    
    # Pipeline Configuration
    enable_analytics: bool = True


class PipecatPipelineBuilder:
    """
    Builds and configures the Pipecat pipeline for streaming conversation
    
    Pipeline flow:
    Audio Input → STT → LLM+RAG → TTS → Audio Output
                    ↓      ↓       ↓
                  Analytics Observer
    """
    
    def __init__(self, config: PipelineConfig):
        self.config = config
        logger.info(f"PipecatPipelineBuilder initialized: stt={config.stt_provider}, tts={config.tts_provider}")
    
    def build_stt_service(self):
        """Build STT service based on configuration"""
        if self.config.stt_provider == "deepgram":
            return DeepgramSTTServiceWrapper(
                language=self.config.stt_language,
                multilingual=self.config.stt_multilingual
            )
        elif self.config.stt_provider == "sarvam":
            return SarvamSTTServiceWrapper(
                language_code=self.config.stt_language
            )
        else:
            raise ValueError(f"Unknown STT provider: {self.config.stt_provider}")
    
    def build_llm_service(self):
        """Build LLM service with RAG integration and conversation history"""
        return OpenAIRAGLLMService(
            system_prompt=self.config.llm_system_prompt,
            use_rag=self.config.llm_use_rag,
            session_id=self.config.session_id  # Pass session_id for history tracking
        )
    
    def build_tts_service(self):
        """Build TTS service based on configuration"""
        if self.config.tts_provider == "deepgram":
            return DeepgramTTSServiceWrapper(
                voice=self.config.tts_voice
            )
        elif self.config.tts_provider == "sarvam":
            return SarvamTTSServiceWrapper(
                language=self.config.tts_language,
                speaker=self.config.tts_speaker
            )
        else:
            raise ValueError(f"Unknown TTS provider: {self.config.tts_provider}")
    
    def build_analytics_observer(self):
        """Build analytics observer for monitoring"""
        return AnalyticsObserver(
            consultation_id=self.config.consultation_id,
            session_db_id=self.config.session_db_id,
            doctor_id=self.config.doctor_id,
            patient_id=self.config.patient_id,
            hospital_id=self.config.hospital_id
        )
    
    def build_pipeline(self, transport) -> Pipeline:
        """
        Build the complete pipeline with all services
        
        Args:
            transport: Transport to use as final output sink
            
        Returns:
            Configured Pipeline ready to run
        """
        # Build all services
        stt_service = self.build_stt_service()
        llm_service = self.build_llm_service()
        tts_service = self.build_tts_service()
        
        # Build pipeline processors list
        # Include transport as final sink to receive TTS output
        processors = [
            stt_service,  # STT: converts audio to text
            llm_service,  # LLM: generates response
            tts_service,  # TTS: converts text to audio
            transport     # Transport: sends audio/text back to client
        ]
        
        # Add analytics observer if enabled
        # Temporarily disabled for testing - TODO: fix AnalyticsObserver initialization
        if False and self.config.enable_analytics:
            analytics_observer = self.build_analytics_observer()
            # Insert analytics observer at the beginning to monitor all frames
            processors.insert(0, analytics_observer)
        
        # Create pipeline
        pipeline = Pipeline(processors)
        
        logger.info(f"Pipeline built with {len(processors)} processors (STT → LLM → TTS → Transport)")
        return pipeline
    
    async def run_pipeline_with_task(self, pipeline, transport):
        """
        Run pipeline using PipelineTask which properly starts all processors
        
        Args:
            pipeline: Built pipeline  
            transport: WebSocket transport for I/O
        """
        logger.info("Starting pipeline with PipelineTask...")
        
        try:
            # Create a PipelineRunner to manage the task
            runner = PipelineRunner()
            
            # Create a PipelineTask
            # This will properly initialize and start all FrameProcessors
            task = PipelineTask(
                pipeline,
                params=PipelineParams(
                    allow_interruptions=True,
                    enable_metrics=False,
                    enable_usage_metrics=False
                )
            )
            
            # Start the task runner in the background
            task_runner = asyncio.create_task(runner.run(task))
            
            logger.info("✅ Pipeline task started, now pumping input frames")
            
            # Pump input frames from WebSocket into pipeline
            # (Output frames flow automatically through pipeline to transport)
            while transport.is_connected() and not task_runner.done():
                try:
                    frame = await transport.input()
                    if frame:
                        logger.info(f"📥 Input: {type(frame).__name__}")
                        await task.queue_frame(frame)
                    else:
                        await asyncio.sleep(0.01)
                except WebSocketDisconnect:
                    logger.info("WebSocket disconnected")
                    break
                except Exception as e:
                    logger.error(f"Input pump error: {e}")
                    if not transport.is_connected():
                        break
                    await asyncio.sleep(0.1)
            
            # Wait for task to complete
            logger.info("Frame pump ended, waiting for task to finish")
            await task_runner
            
            logger.info("✅ Pipeline task completed")
        
        except asyncio.CancelledError:
            logger.info("⚠️ Pipeline task cancelled")
        
        except Exception as e:
            logger.error(f"❌ Pipeline task error: {e}", exc_info=True)
            raise
        
        finally:
            logger.info("Pipeline task ended")


class PipelineManager:
    """
    Manages multiple active pipelines for different sessions
    Handles lifecycle and cleanup
    """
    
    def __init__(self):
        self._active_pipelines = {}
        logger.info("PipelineManager initialized")
    
    async def create_pipeline(
        self,
        session_id: str,
        config: PipelineConfig,
        transport
    ):
        """
        Create and register a new pipeline for a session
        
        Args:
            session_id: Unique session identifier
            config: Pipeline configuration
            transport: WebSocket transport
            
        Returns:
            Pipeline ready to run
        """
        if session_id in self._active_pipelines:
            logger.warning(f"Pipeline already exists for session {session_id}, stopping old one")
            await self.stop_pipeline(session_id)
        
        # Build pipeline with transport as sink
        builder = PipecatPipelineBuilder(config)
        pipeline = builder.build_pipeline(transport)
        
        # Store pipeline and transport
        self._active_pipelines[session_id] = {
            'pipeline': pipeline,
            'builder': builder,
            'transport': transport
        }
        logger.info(f"Pipeline created for session {session_id}")
        
        return pipeline, builder
    
    async def stop_pipeline(self, session_id: str):
        """
        Stop a running pipeline
        
        Args:
            session_id: Session to stop
        """
        if session_id in self._active_pipelines:
            pipeline_data = self._active_pipelines[session_id]
            pipeline = pipeline_data.get('pipeline')
            transport = pipeline_data.get('transport')
            try:
                # Close the transport to stop the pipeline
                if transport:
                    await transport.stop()
                logger.info(f"Pipeline stopped for session {session_id}")
            except Exception as e:
                logger.error(f"Error stopping pipeline for session {session_id}: {e}")
            finally:
                del self._active_pipelines[session_id]
    
    async def stop_all_pipelines(self):
        """Stop all active pipelines"""
        session_ids = list(self._active_pipelines.keys())
        for session_id in session_ids:
            await self.stop_pipeline(session_id)
        logger.info("All pipelines stopped")
    
    def get_active_sessions(self) -> list:
        """Get list of active session IDs"""
        return list(self._active_pipelines.keys())
    
    def get_pipeline_count(self) -> int:
        """Get number of active pipelines"""
        return len(self._active_pipelines)

