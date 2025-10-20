"""
Base Service Class
Common functionality for all integration services
"""

import time
import logging
from typing import Optional, Dict, Any
from abc import ABC

logger = logging.getLogger(__name__)

class BaseService(ABC):
    """Base class for all integration services with common production features"""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        
        # Circuit breaker state
        self._failure_count = 0
        self._circuit_breaker_timestamp = 0
        self._request_times = []
        
        # Lazy load config to avoid import issues at startup
        self._config = None
        self._monitoring = None
    
    def _get_config(self):
        """Lazy load configuration"""
        if self._config is None:
            try:
                # Try to import config, but don't fail if it doesn't exist
                import prod_config.production_config
                self._config = prod_config.production_config.config
            except ImportError:
                # Fallback to default config if import fails
                self._config = type('Config', (), {
                    'get_service_config': lambda service_name: type('ServiceConfig', (), {
                        'rate_limit': 60,
                        'max_failures': 5,
                        'circuit_breaker_reset_time': 60,
                        'timeout': 30.0,
                        'max_retries': 2,
                        'retry_delay': 0.5,
                        'max_text_length': 10000,
                        'max_audio_size_mb': 50,
                        'max_audio_duration_sec': 300
                    })()
                })()
        return self._config
    
    def _get_monitoring(self):
        """Lazy load monitoring"""
        if self._monitoring is None:
            try:
                # Try to import monitoring, but don't fail if it doesn't exist
                import monitoring.monitoring
                self._monitoring = monitoring.monitoring.monitoring
            except ImportError:
                # Fallback to no-op monitoring
                self._monitoring = type('NoOpMonitoring', (), {
                    'record_request': lambda *args, **kwargs: None
                })()
        return self._monitoring
    
    def _check_rate_limit(self) -> bool:
        """Check if we're within rate limits"""
        current_time = time.time()
        # Remove requests older than 1 minute
        self._request_times = [t for t in self._request_times if current_time - t < 60]
        
        service_config = self._get_config().get_service_config(self.service_name)
        if len(self._request_times) >= service_config.rate_limit:
            logger.warning(f"{self.service_name} rate limit exceeded: {len(self._request_times)} requests in last minute")
            return False
        
        self._request_times.append(current_time)
        return True
    
    def _check_circuit_breaker(self) -> bool:
        """Check if circuit breaker is open"""
        current_time = time.time()
        service_config = self._get_config().get_service_config(self.service_name)
        
        # Reset circuit breaker if enough time has passed
        if current_time - self._circuit_breaker_timestamp > service_config.circuit_breaker_reset_time:
            self._failure_count = 0
            logger.info(f"{self.service_name} circuit breaker reset")
        
        return self._failure_count < service_config.max_failures
    
    def _record_failure(self, error_type: str = None):
        """Record an API failure for circuit breaker"""
        self._failure_count += 1
        self._circuit_breaker_timestamp = time.time()
        service_config = self._get_config().get_service_config(self.service_name)
        logger.warning(f"{self.service_name} API failure recorded: {self._failure_count}/{service_config.max_failures}")
        
        # Record in monitoring
        self._get_monitoring().record_request(
            service=self.service_name,
            success=False,
            latency_ms=0.0,
            error_type=error_type,
            circuit_breaker_trip=True
        )
    
    def _record_success(self, latency_ms: float):
        """Record an API success for circuit breaker"""
        if self._failure_count > 0:
            self._failure_count = 0
            logger.info(f"{self.service_name} API success recorded, circuit breaker reset")
        
        # Record in monitoring
        self._get_monitoring().record_request(
            service=self.service_name,
            success=True,
            latency_ms=latency_ms
        )
    
    def _validate_text_input(self, text: str) -> bool:
        """Validate text input"""
        if not text or not isinstance(text, str):
            logger.warning(f"Invalid text input for {self.service_name}")
            return False
        
        if len(text.strip()) == 0:
            logger.warning(f"Empty text input for {self.service_name}")
            return False
            
        service_config = self._get_config().get_service_config(self.service_name)
        if len(text) > service_config.max_text_length:
            logger.warning(f"Text too long for {self.service_name}: {len(text)} chars (max: {service_config.max_text_length})")
            return False
            
        return True
    
    def _validate_audio_input(self, audio_bytes: bytes) -> bool:
        """Validate audio input"""
        if not audio_bytes or not isinstance(audio_bytes, bytes):
            logger.warning(f"Invalid audio input for {self.service_name}")
            return False
        
        if len(audio_bytes) == 0:
            logger.warning(f"Empty audio input for {self.service_name}")
            return False
            
        service_config = self._get_config().get_service_config(self.service_name)
        max_size_bytes = service_config.max_audio_size_mb * 1024 * 1024
        if len(audio_bytes) > max_size_bytes:
            logger.warning(f"Audio too large for {self.service_name}: {len(audio_bytes)} bytes (max: {max_size_bytes})")
            return False
            
        # Rough duration estimate (assuming 16kHz, 16-bit audio)
        estimated_duration = len(audio_bytes) / (16000 * 2)  # 2 bytes per sample
        if estimated_duration > service_config.max_audio_duration_sec:
            logger.warning(f"Audio too long for {self.service_name}: {estimated_duration:.1f}s (max: {service_config.max_audio_duration_sec}s)")
            return False
            
        return True
    
    def _should_skip_request(self, text: str = None, audio_bytes: bytes = None) -> bool:
        """Check if request should be skipped based on rate limits and circuit breaker"""
        try:
            config_obj = self._get_config()
            
            # Check rate limiting
            if hasattr(config_obj, 'SECURITY') and config_obj.SECURITY.get('enable_rate_limiting', True) and not self._check_rate_limit():
                logger.warning(f"{self.service_name} rate limit exceeded, returning None")
                self._get_monitoring().record_request(
                    service=self.service_name,
                    success=False,
                    latency_ms=0.0,
                    rate_limit_hit=True
                )
                return True
            
            # Check circuit breaker
            if hasattr(config_obj, 'SECURITY') and config_obj.SECURITY.get('enable_circuit_breaker', True) and not self._check_circuit_breaker():
                logger.warning(f"{self.service_name} circuit breaker open, returning None")
                self._get_monitoring().record_request(
                    service=self.service_name,
                    success=False,
                    latency_ms=0.0,
                    circuit_breaker_trip=True
                )
                return True
        except Exception as e:
            logger.warning(f"Error checking rate limits/circuit breaker: {e}")
            # If there's an error, don't skip the request
        
        # Validate inputs
        if text and not self._validate_text_input(text):
            return True
            
        if audio_bytes and not self._validate_audio_input(audio_bytes):
            return True
        
        return False
    
    def _record_request_result(self, success: bool, latency_ms: float, error_type: str = None):
        """Record request result in monitoring"""
        self._get_monitoring().record_request(
            service=self.service_name,
            success=success,
            latency_ms=latency_ms,
            error_type=error_type
        )
    
    async def health_check(self) -> Dict[str, Any]:
        """Default health check method"""
        try:
            return {
                "status": "healthy",
                "service": self.service_name,
                "circuit_breaker": {
                    "is_open": self._failure_count >= 5,  # Default max failures
                    "failure_count": self._failure_count
                },
                "rate_limiting": {
                    "current_requests": len(self._request_times),
                    "rate_limit": 60  # Default rate limit
                }
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "service": self.service_name,
                "error": str(e)
            }
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get service information"""
        try:
            service_config = self._get_config().get_service_config(self.service_name)
            return {
                'service_name': self.service_name,
                'config': {
                    'rate_limit': service_config.rate_limit,
                    'max_failures': service_config.max_failures,
                    'circuit_breaker_reset_time': service_config.circuit_breaker_reset_time,
                    'timeout': service_config.timeout,
                    'max_retries': service_config.max_retries,
                    'max_text_length': service_config.max_text_length,
                    'max_audio_size_mb': service_config.max_audio_size_mb,
                    'max_audio_duration_sec': service_config.max_audio_duration_sec
                },
                'circuit_breaker': {
                    'failure_count': self._failure_count,
                    'is_open': self._failure_count >= service_config.max_failures,
                    'last_reset': self._circuit_breaker_timestamp
                },
                'rate_limiting': {
                    'current_requests': len(self._request_times),
                    'rate_limit': service_config.rate_limit,
                    'is_limited': len(self._request_times) >= service_config.rate_limit
                }
            }
        except Exception as e:
            return {
                'service_name': self.service_name,
                'config': 'default',
                'error': str(e)
            }
