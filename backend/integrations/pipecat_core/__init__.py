"""
Pipecat Integration for Avatar OpenAI
Orchestration layer for streaming STT → LLM+RAG → TTS pipeline
"""

from .services import (
    DeepgramSTTServiceWrapper,
    SarvamSTTServiceWrapper,
    OpenAIRAGLLMService,
    DeepgramTTSServiceWrapper,
    SarvamTTSServiceWrapper,
    AnalyticsObserver
)
from .pipeline import PipecatPipelineBuilder, PipelineConfig, PipelineManager
from .transport import AuthenticatedWebSocketTransport

__all__ = [
    'DeepgramSTTServiceWrapper',
    'SarvamSTTServiceWrapper',
    'OpenAIRAGLLMService',
    'DeepgramTTSServiceWrapper',
    'SarvamTTSServiceWrapper',
    'AnalyticsObserver',
    'PipecatPipelineBuilder',
    'PipelineConfig',
    'PipelineManager',
    'AuthenticatedWebSocketTransport'
]

