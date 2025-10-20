"""
Centralized Production Configuration
Unified configuration for all API services and integrations
"""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class ServiceConfig:
    """Configuration for individual services"""
    rate_limit: int = 60
    max_failures: int = 5
    circuit_breaker_reset_time: int = 60
    timeout: float = 30.0
    max_retries: int = 2
    retry_delay: float = 0.5
    max_text_length: int = 10000
    max_audio_size_mb: int = 50
    max_audio_duration_sec: int = 300

class ProductionConfig:
    """Centralized production configuration for all services"""
    
    # Environment Detection
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
    IS_PRODUCTION = ENVIRONMENT.lower() in ['production', 'prod']
    
    # General Service Configuration
    SERVICES = {
        'sarvam': ServiceConfig(
            rate_limit=int(os.getenv('SARVAM_RATE_LIMIT', '60')),
            max_failures=int(os.getenv('SARVAM_MAX_FAILURES', '5')),
            circuit_breaker_reset_time=int(os.getenv('SARVAM_CIRCUIT_RESET_TIME', '60')),
            timeout=float(os.getenv('SARVAM_TIMEOUT', '30.0')),
            max_retries=int(os.getenv('SARVAM_MAX_RETRIES', '2')),
            retry_delay=float(os.getenv('SARVAM_RETRY_DELAY', '0.5')),
            max_text_length=int(os.getenv('SARVAM_MAX_TEXT_LENGTH', '10000')),
            max_audio_size_mb=int(os.getenv('SARVAM_MAX_AUDIO_SIZE_MB', '50')),
            max_audio_duration_sec=int(os.getenv('SARVAM_MAX_AUDIO_DURATION_SEC', '300'))
        ),
        'deepgram': ServiceConfig(
            rate_limit=int(os.getenv('DEEPGRAM_RATE_LIMIT', '100')),
            max_failures=int(os.getenv('DEEPGRAM_MAX_FAILURES', '5')),
            circuit_breaker_reset_time=int(os.getenv('DEEPGRAM_CIRCUIT_RESET_TIME', '60')),
            timeout=float(os.getenv('DEEPGRAM_TIMEOUT', '30.0')),
            max_retries=int(os.getenv('DEEPGRAM_MAX_RETRIES', '2')),
            retry_delay=float(os.getenv('DEEPGRAM_RETRY_DELAY', '0.5')),
            max_text_length=int(os.getenv('DEEPGRAM_MAX_TEXT_LENGTH', '10000')),
            max_audio_size_mb=int(os.getenv('DEEPGRAM_MAX_AUDIO_SIZE_MB', '100')),
            max_audio_duration_sec=int(os.getenv('DEEPGRAM_MAX_AUDIO_DURATION_SEC', '600'))
        ),
        'openai': ServiceConfig(
            rate_limit=int(os.getenv('OPENAI_RATE_LIMIT', '1000')),
            max_failures=int(os.getenv('OPENAI_MAX_FAILURES', '10')),
            circuit_breaker_reset_time=int(os.getenv('OPENAI_CIRCUIT_RESET_TIME', '120')),
            timeout=float(os.getenv('OPENAI_TIMEOUT', '60.0')),
            max_retries=int(os.getenv('OPENAI_MAX_RETRIES', '3')),
            retry_delay=float(os.getenv('OPENAI_RETRY_DELAY', '1.0')),
            max_text_length=int(os.getenv('OPENAI_MAX_TEXT_LENGTH', '50000')),
            max_audio_size_mb=int(os.getenv('OPENAI_MAX_AUDIO_SIZE_MB', '25')),
            max_audio_duration_sec=int(os.getenv('OPENAI_MAX_AUDIO_DURATION_SEC', '300'))
        ),
        'rag': ServiceConfig(
            rate_limit=int(os.getenv('RAG_RATE_LIMIT', '200')),
            max_failures=int(os.getenv('RAG_MAX_FAILURES', '5')),
            circuit_breaker_reset_time=int(os.getenv('RAG_CIRCUIT_RESET_TIME', '60')),
            timeout=float(os.getenv('RAG_TIMEOUT', '10.0')),
            max_retries=int(os.getenv('RAG_MAX_RETRIES', '2')),
            retry_delay=float(os.getenv('RAG_RETRY_DELAY', '0.5')),
            max_text_length=int(os.getenv('RAG_MAX_TEXT_LENGTH', '5000')),
            max_audio_size_mb=int(os.getenv('RAG_MAX_AUDIO_SIZE_MB', '25')),
            max_audio_duration_sec=int(os.getenv('RAG_MAX_AUDIO_DURATION_SEC', '300'))
        )
    }
    
    # Monitoring Configuration
    MONITORING = {
        'enable_metrics': os.getenv('ENABLE_METRICS', 'true').lower() == 'true',
        'metrics_interval': int(os.getenv('METRICS_INTERVAL', '60')),
        'health_check_interval': int(os.getenv('HEALTH_CHECK_INTERVAL', '30')),
        'alert_thresholds': {
            'success_rate_warning': float(os.getenv('SUCCESS_RATE_WARNING', '95.0')),
            'success_rate_critical': float(os.getenv('SUCCESS_RATE_CRITICAL', '80.0')),
            'latency_warning_ms': float(os.getenv('LATENCY_WARNING_MS', '5000.0')),
            'latency_critical_ms': float(os.getenv('LATENCY_CRITICAL_MS', '10000.0'))
        }
    }
    
    # Database Configuration
    DATABASE = {
        'connection_pool_size': int(os.getenv('DB_POOL_SIZE', '20')),
        'connection_timeout': int(os.getenv('DB_TIMEOUT', '30')),
        'query_timeout': int(os.getenv('DB_QUERY_TIMEOUT', '60')),
        'enable_query_logging': os.getenv('DB_QUERY_LOGGING', 'false').lower() == 'true'
    }
    
    # Cache Configuration
    CACHE = {
        'redis_ttl': int(os.getenv('REDIS_TTL', '3600')),
        'translation_cache_size': int(os.getenv('TRANSLATION_CACHE_SIZE', '1000')),
        'rag_cache_size': int(os.getenv('RAG_CACHE_SIZE', '500')),
        'enable_cache': os.getenv('ENABLE_CACHE', 'true').lower() == 'true'
    }
    
    # Security Configuration
    SECURITY = {
        'api_key_rotation_hours': int(os.getenv('API_KEY_ROTATION_HOURS', '24')),
        'max_request_size_mb': int(os.getenv('MAX_REQUEST_SIZE_MB', '100')),
        'enable_rate_limiting': os.getenv('ENABLE_RATE_LIMITING', 'true').lower() == 'true',
        'enable_circuit_breaker': os.getenv('ENABLE_CIRCUIT_BREAKER', 'true').lower() == 'true'
    }
    
    @classmethod
    def get_service_config(cls, service_name: str) -> ServiceConfig:
        """Get configuration for a specific service"""
        return cls.SERVICES.get(service_name, ServiceConfig())
    
    @classmethod
    def get_all_config(cls) -> Dict[str, Any]:
        """Get all configuration as dictionary"""
        return {
            'environment': cls.ENVIRONMENT,
            'is_production': cls.IS_PRODUCTION,
            'services': {
                name: {
                    'rate_limit': config.rate_limit,
                    'max_failures': config.max_failures,
                    'circuit_breaker_reset_time': config.circuit_breaker_reset_time,
                    'timeout': config.timeout,
                    'max_retries': config.max_retries,
                    'retry_delay': config.retry_delay,
                    'max_text_length': config.max_text_length,
                    'max_audio_size_mb': config.max_audio_size_mb,
                    'max_audio_duration_sec': config.max_audio_duration_sec
                }
                for name, config in cls.SERVICES.items()
            },
            'monitoring': cls.MONITORING,
            'database': cls.DATABASE,
            'cache': cls.CACHE,
            'security': cls.SECURITY
        }
    
    @classmethod
    def is_development(cls) -> bool:
        """Check if running in development mode"""
        return not cls.IS_PRODUCTION
    
    @classmethod
    def is_production(cls) -> bool:
        """Check if running in production mode"""
        return cls.IS_PRODUCTION

# Global configuration instance
config = ProductionConfig()
