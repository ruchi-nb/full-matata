"""
Centralized Monitoring System
Production-grade monitoring for all API services
"""

import time
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from collections import defaultdict, deque
import threading
import asyncio
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

@dataclass
class ServiceMetrics:
    """Comprehensive metrics for a service"""
    service_name: str
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    total_latency_ms: float = 0.0
    average_latency_ms: float = 0.0
    min_latency_ms: float = float('inf')
    max_latency_ms: float = 0.0
    circuit_breaker_trips: int = 0
    rate_limit_hits: int = 0
    last_request_time: float = 0.0
    last_success_time: float = 0.0
    last_failure_time: float = 0.0
    error_counts: Dict[str, int] = field(default_factory=dict)
    recent_requests: deque = field(default_factory=lambda: deque(maxlen=100))

class CentralizedMonitoring:
    """Centralized monitoring for all services with advanced analytics"""
    
    def __init__(self):
        self._metrics = {}
        self._lock = threading.RLock()
        self._start_time = time.time()
        self._alerts = []
        self._alert_thresholds = {
            'success_rate_warning': 95.0,
            'success_rate_critical': 80.0,
            'latency_warning_ms': 5000.0,
            'latency_critical_ms': 10000.0,
            'error_rate_warning': 5.0,
            'error_rate_critical': 20.0
        }
        
        # Initialize metrics for known services
        self._initialize_services()
        
        logger.info("Centralized monitoring system initialized")
    
    def _initialize_services(self):
        """Initialize metrics for all known services"""
        services = ['sarvam', 'deepgram', 'openai', 'rag']
        for service in services:
            self._metrics[service] = ServiceMetrics(service_name=service)
    
    def record_request(self, service: str, success: bool, latency_ms: float, 
                      error_type: str = None, circuit_breaker_trip: bool = False, 
                      rate_limit_hit: bool = False, additional_data: Dict = None):
        """Record a request with comprehensive metrics"""
        current_time = time.time()
        
        with self._lock:
            if service not in self._metrics:
                self._metrics[service] = ServiceMetrics(service_name=service)
            
            metrics = self._metrics[service]
            metrics.total_requests += 1
            metrics.last_request_time = current_time
            
            # Update latency statistics
            metrics.total_latency_ms += latency_ms
            metrics.average_latency_ms = metrics.total_latency_ms / metrics.total_requests
            metrics.min_latency_ms = min(metrics.min_latency_ms, latency_ms)
            metrics.max_latency_ms = max(metrics.max_latency_ms, latency_ms)
            
            if success:
                metrics.successful_requests += 1
                metrics.last_success_time = current_time
            else:
                metrics.failed_requests += 1
                metrics.last_failure_time = current_time
                
                # Track error types
                if error_type:
                    metrics.error_counts[error_type] = metrics.error_counts.get(error_type, 0) + 1
            
            if circuit_breaker_trip:
                metrics.circuit_breaker_trips += 1
            
            if rate_limit_hit:
                metrics.rate_limit_hits += 1
            
            # Store recent request for trend analysis
            request_data = {
                'timestamp': current_time,
                'success': success,
                'latency_ms': latency_ms,
                'error_type': error_type,
                'additional_data': additional_data or {}
            }
            metrics.recent_requests.append(request_data)
            
            # Check for alerts
            self._check_alerts(service, metrics)
    
    def _check_alerts(self, service: str, metrics: ServiceMetrics):
        """Check for alert conditions"""
        current_time = time.time()
        alerts = []
        
        # Success rate alerts
        if metrics.total_requests > 0:
            success_rate = (metrics.successful_requests / metrics.total_requests) * 100
            
            if success_rate < self._alert_thresholds['success_rate_critical']:
                alerts.append({
                    'type': 'critical',
                    'service': service,
                    'message': f"Critical success rate: {success_rate:.1f}%",
                    'timestamp': current_time,
                    'value': success_rate,
                    'threshold': self._alert_thresholds['success_rate_critical']
                })
            elif success_rate < self._alert_thresholds['success_rate_warning']:
                alerts.append({
                    'type': 'warning',
                    'service': service,
                    'message': f"Low success rate: {success_rate:.1f}%",
                    'timestamp': current_time,
                    'value': success_rate,
                    'threshold': self._alert_thresholds['success_rate_warning']
                })
        
        # Latency alerts
        if metrics.average_latency_ms > self._alert_thresholds['latency_critical_ms']:
            alerts.append({
                'type': 'critical',
                'service': service,
                'message': f"Critical latency: {metrics.average_latency_ms:.1f}ms",
                'timestamp': current_time,
                'value': metrics.average_latency_ms,
                'threshold': self._alert_thresholds['latency_critical_ms']
            })
        elif metrics.average_latency_ms > self._alert_thresholds['latency_warning_ms']:
            alerts.append({
                'type': 'warning',
                'service': service,
                'message': f"High latency: {metrics.average_latency_ms:.1f}ms",
                'timestamp': current_time,
                'value': metrics.average_latency_ms,
                'threshold': self._alert_thresholds['latency_warning_ms']
            })
        
        # Circuit breaker alerts
        if metrics.circuit_breaker_trips > 10:
            alerts.append({
                'type': 'critical',
                'service': service,
                'message': f"Frequent circuit breaker trips: {metrics.circuit_breaker_trips}",
                'timestamp': current_time,
                'value': metrics.circuit_breaker_trips,
                'threshold': 10
            })
        
        # Rate limiting alerts
        if metrics.rate_limit_hits > 20:
            alerts.append({
                'type': 'warning',
                'service': service,
                'message': f"Frequent rate limiting: {metrics.rate_limit_hits}",
                'timestamp': current_time,
                'value': metrics.rate_limit_hits,
                'threshold': 20
            })
        
        # Add new alerts
        for alert in alerts:
            if alert not in self._alerts:
                self._alerts.append(alert)
                logger.warning(f"ALERT [{alert['type'].upper()}] {service}: {alert['message']}")
        
        # Clean old alerts (keep last 100)
        self._alerts = self._alerts[-100:]
    
    def get_metrics(self, service: Optional[str] = None) -> Dict[str, Any]:
        """Get comprehensive metrics for a service or all services"""
        with self._lock:
            if service:
                if service not in self._metrics:
                    return {}
                return self._get_service_metrics(service)
            else:
                return {
                    service_name: self._get_service_metrics(service_name)
                    for service_name in self._metrics.keys()
                }
    
    def _get_service_metrics(self, service: str) -> Dict[str, Any]:
        """Get detailed metrics for a specific service"""
        metrics = self._metrics[service]
        recent_requests = list(metrics.recent_requests)
        
        # Calculate success rate
        success_rate = 0.0
        if metrics.total_requests > 0:
            success_rate = (metrics.successful_requests / metrics.total_requests) * 100
        
        # Calculate recent trends (last 20 requests)
        recent_success_rate = 0.0
        recent_avg_latency = 0.0
        if len(recent_requests) >= 10:
            recent_requests = recent_requests[-20:]
            recent_successes = sum(1 for req in recent_requests if req['success'])
            recent_success_rate = (recent_successes / len(recent_requests)) * 100
            recent_avg_latency = sum(req['latency_ms'] for req in recent_requests) / len(recent_requests)
        
        # Calculate error distribution
        total_errors = sum(metrics.error_counts.values())
        error_distribution = {}
        for error_type, count in metrics.error_counts.items():
            error_distribution[error_type] = {
                'count': count,
                'percentage': (count / total_errors * 100) if total_errors > 0 else 0
            }
        
        # Calculate uptime and availability
        uptime_seconds = time.time() - self._start_time
        availability = 100.0  # Default to 100%
        if metrics.total_requests > 0 and metrics.last_failure_time > 0:
            time_since_last_failure = time.time() - metrics.last_failure_time
            if time_since_last_failure < 300:  # 5 minutes
                availability = 95.0  # Assume degraded if recent failures
        
        return {
            'service_name': metrics.service_name,
            'total_requests': metrics.total_requests,
            'successful_requests': metrics.successful_requests,
            'failed_requests': metrics.failed_requests,
            'success_rate': round(success_rate, 2),
            'recent_success_rate': round(recent_success_rate, 2),
            'average_latency_ms': round(metrics.average_latency_ms, 2),
            'recent_avg_latency_ms': round(recent_avg_latency, 2),
            'min_latency_ms': round(metrics.min_latency_ms, 2) if metrics.min_latency_ms != float('inf') else 0,
            'max_latency_ms': round(metrics.max_latency_ms, 2),
            'circuit_breaker_trips': metrics.circuit_breaker_trips,
            'rate_limit_hits': metrics.rate_limit_hits,
            'error_distribution': error_distribution,
            'availability': round(availability, 2),
            'uptime_seconds': round(uptime_seconds, 2),
            'last_request_time': metrics.last_request_time,
            'last_success_time': metrics.last_success_time,
            'last_failure_time': metrics.last_failure_time,
            'recent_requests_count': len(recent_requests)
        }
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get comprehensive health status of all services"""
        with self._lock:
            health_status = {
                'overall_status': 'healthy',
                'services': {},
                'alerts': self._alerts[-20:],  # Last 20 alerts
                'summary': {
                    'total_services': len(self._metrics),
                    'healthy_services': 0,
                    'degraded_services': 0,
                    'unhealthy_services': 0,
                    'total_requests': 0,
                    'total_success_rate': 0.0
                }
            }
            
            total_requests = 0
            total_successful = 0
            
            for service_name, metrics in self._metrics.items():
                service_health = 'healthy'
                alerts = []
                
                # Check success rate
                if metrics.total_requests > 0:
                    success_rate = (metrics.successful_requests / metrics.total_requests) * 100
                    total_requests += metrics.total_requests
                    total_successful += metrics.successful_requests
                    
                    if success_rate < self._alert_thresholds['success_rate_critical']:
                        service_health = 'unhealthy'
                        alerts.append(f"Critical success rate: {success_rate:.1f}%")
                    elif success_rate < self._alert_thresholds['success_rate_warning']:
                        service_health = 'degraded'
                        alerts.append(f"Low success rate: {success_rate:.1f}%")
                
                # Check latency
                if metrics.average_latency_ms > self._alert_thresholds['latency_critical_ms']:
                    service_health = 'unhealthy'
                    alerts.append(f"Critical latency: {metrics.average_latency_ms:.1f}ms")
                elif metrics.average_latency_ms > self._alert_thresholds['latency_warning_ms']:
                    if service_health == 'healthy':
                        service_health = 'degraded'
                    alerts.append(f"High latency: {metrics.average_latency_ms:.1f}ms")
                
                # Check circuit breaker
                if metrics.circuit_breaker_trips > 10:
                    if service_health == 'healthy':
                        service_health = 'degraded'
                    alerts.append(f"Frequent circuit breaker trips: {metrics.circuit_breaker_trips}")
                
                health_status['services'][service_name] = {
                    'status': service_health,
                    'alerts': alerts,
                    'metrics': self._get_service_metrics(service_name)
                }
                
                # Update summary counters
                if service_health == 'healthy':
                    health_status['summary']['healthy_services'] += 1
                elif service_health == 'degraded':
                    health_status['summary']['degraded_services'] += 1
                else:
                    health_status['summary']['unhealthy_services'] += 1
                
                if service_health != 'healthy':
                    health_status['overall_status'] = 'degraded'
            
            # Calculate overall success rate
            if total_requests > 0:
                health_status['summary']['total_success_rate'] = round((total_successful / total_requests) * 100, 2)
            
            health_status['summary']['total_requests'] = total_requests
            
            return health_status
    
    def get_alerts(self, alert_type: Optional[str] = None, limit: int = 50) -> List[Dict]:
        """Get alerts filtered by type"""
        with self._lock:
            alerts = self._alerts[-limit:]
            if alert_type:
                alerts = [alert for alert in alerts if alert.get('type') == alert_type]
            return alerts
    
    def reset_metrics(self, service: Optional[str] = None):
        """Reset metrics for a service or all services"""
        with self._lock:
            if service:
                if service in self._metrics:
                    self._metrics[service] = ServiceMetrics(service_name=service)
                    logger.info(f"Metrics reset for service: {service}")
            else:
                for service_name in self._metrics:
                    self._metrics[service_name] = ServiceMetrics(service_name=service_name)
                self._alerts.clear()
                logger.info("All metrics and alerts reset")
    
    def set_alert_thresholds(self, thresholds: Dict[str, float]):
        """Update alert thresholds"""
        with self._lock:
            self._alert_thresholds.update(thresholds)
            logger.info(f"Alert thresholds updated: {thresholds}")
    
    def get_performance_trends(self, service: str, hours: int = 24) -> Dict[str, Any]:
        """Get performance trends over time"""
        with self._lock:
            if service not in self._metrics:
                return {}
            
            metrics = self._metrics[service]
            cutoff_time = time.time() - (hours * 3600)
            recent_requests = [req for req in metrics.recent_requests if req['timestamp'] >= cutoff_time]
            
            if not recent_requests:
                return {'trend': 'no_data', 'message': 'No recent data available'}
            
            # Calculate trends
            success_rate_trend = 'stable'
            latency_trend = 'stable'
            
            if len(recent_requests) >= 20:
                # Split into two halves
                mid_point = len(recent_requests) // 2
                first_half = recent_requests[:mid_point]
                second_half = recent_requests[mid_point:]
                
                # Success rate trend
                first_success_rate = sum(1 for req in first_half if req['success']) / len(first_half) * 100
                second_success_rate = sum(1 for req in second_half if req['success']) / len(second_half) * 100
                
                if second_success_rate - first_success_rate > 5:
                    success_rate_trend = 'improving'
                elif first_success_rate - second_success_rate > 5:
                    success_rate_trend = 'declining'
                
                # Latency trend
                first_avg_latency = sum(req['latency_ms'] for req in first_half) / len(first_half)
                second_avg_latency = sum(req['latency_ms'] for req in second_half) / len(second_half)
                
                if second_avg_latency - first_avg_latency > first_avg_latency * 0.2:
                    latency_trend = 'increasing'
                elif first_avg_latency - second_avg_latency > first_avg_latency * 0.2:
                    latency_trend = 'decreasing'
            
            return {
                'trend': 'analyzed',
                'success_rate_trend': success_rate_trend,
                'latency_trend': latency_trend,
                'data_points': len(recent_requests),
                'time_range_hours': hours
            }

# Global monitoring instance
monitoring = CentralizedMonitoring()
