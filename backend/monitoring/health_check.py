"""
Centralized Health Check System
Production-grade health monitoring for all services
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional, List
import logging
import time
from .monitoring import monitoring
from prod_config.production_config import config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])

@router.get("/")
async def overall_health_check() -> Dict[str, Any]:
    """Overall system health check"""
    try:
        health_status = monitoring.get_health_status()
        uptime_seconds = time.time() - monitoring._start_time
        
        return {
            "status": "ok" if health_status['overall_status'] == 'healthy' else "degraded",
            "timestamp": time.time(),
            "uptime_seconds": round(uptime_seconds, 2),
            "overall_status": health_status['overall_status'],
            "summary": health_status['summary'],
            "services_count": len(health_status['services']),
            "active_alerts": len([a for a in health_status['alerts'] if a.get('type') == 'critical'])
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Health check failed")

@router.get("/services")
async def services_health_check() -> Dict[str, Any]:
    """Detailed health check for all services"""
    try:
        health_status = monitoring.get_health_status()
        
        return {
            "status": "ok",
            "timestamp": time.time(),
            "services": health_status['services'],
            "overall_status": health_status['overall_status']
        }
    except Exception as e:
        logger.error(f"Services health check failed: {e}")
        raise HTTPException(status_code=503, detail="Services health check failed")

@router.get("/services/{service_name}")
async def service_health_check(service_name: str) -> Dict[str, Any]:
    """Health check for a specific service"""
    try:
        metrics = monitoring.get_metrics(service_name)
        if not metrics:
            raise HTTPException(status_code=404, detail=f"Service {service_name} not found")
        
        health_status = monitoring.get_health_status()
        service_health = health_status['services'].get(service_name, {})
        
        return {
            "status": "ok",
            "timestamp": time.time(),
            "service": service_name,
            "health": service_health,
            "metrics": metrics
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Service health check failed for {service_name}: {e}")
        raise HTTPException(status_code=503, detail=f"Service health check failed: {str(e)}")

@router.get("/metrics")
async def get_metrics(service: Optional[str] = Query(None, description="Service name to get metrics for")) -> Dict[str, Any]:
    """Get detailed metrics for services"""
    try:
        metrics = monitoring.get_metrics(service)
        
        return {
            "status": "ok",
            "timestamp": time.time(),
            "metrics": metrics,
            "service": service or "all"
        }
    except Exception as e:
        logger.error(f"Metrics retrieval failed: {e}")
        raise HTTPException(status_code=503, detail="Metrics retrieval failed")

@router.get("/alerts")
async def get_alerts(
    alert_type: Optional[str] = Query(None, description="Filter by alert type (warning, critical)"),
    limit: int = Query(50, description="Maximum number of alerts to return")
) -> Dict[str, Any]:
    """Get system alerts"""
    try:
        alerts = monitoring.get_alerts(alert_type, limit)
        
        return {
            "status": "ok",
            "timestamp": time.time(),
            "alerts": alerts,
            "total_alerts": len(alerts),
            "alert_type_filter": alert_type
        }
    except Exception as e:
        logger.error(f"Alerts retrieval failed: {e}")
        raise HTTPException(status_code=503, detail="Alerts retrieval failed")

@router.get("/trends/{service_name}")
async def get_performance_trends(
    service_name: str,
    hours: int = Query(24, description="Number of hours to analyze trends for")
) -> Dict[str, Any]:
    """Get performance trends for a service"""
    try:
        trends = monitoring.get_performance_trends(service_name, hours)
        if not trends:
            raise HTTPException(status_code=404, detail=f"Service {service_name} not found or no data")
        
        return {
            "status": "ok",
            "timestamp": time.time(),
            "service": service_name,
            "trends": trends,
            "analysis_hours": hours
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Trends retrieval failed for {service_name}: {e}")
        raise HTTPException(status_code=503, detail=f"Trends retrieval failed: {str(e)}")

@router.post("/reset")
async def reset_metrics(
    service: Optional[str] = Query(None, description="Service name to reset metrics for (resets all if not specified)")
) -> Dict[str, str]:
    """Reset metrics for services"""
    try:
        monitoring.reset_metrics(service)
        if service:
            return {"status": "ok", "message": f"Metrics reset for {service}"}
        else:
            return {"status": "ok", "message": "All metrics and alerts reset"}
    except Exception as e:
        logger.error(f"Metrics reset failed: {e}")
        raise HTTPException(status_code=500, detail="Metrics reset failed")

@router.get("/configuration")
async def get_configuration() -> Dict[str, Any]:
    """Get current system configuration"""
    try:
        return {
            "status": "ok",
            "timestamp": time.time(),
            "configuration": config.get_all_config()
        }
    except Exception as e:
        logger.error(f"Configuration retrieval failed: {e}")
        raise HTTPException(status_code=503, detail="Configuration retrieval failed")

@router.get("/status")
async def system_status() -> Dict[str, Any]:
    """Get comprehensive system status"""
    try:
        health_status = monitoring.get_health_status()
        uptime_seconds = time.time() - monitoring._start_time
        
        # Get recent alerts
        recent_alerts = monitoring.get_alerts(limit=10)
        
        # Calculate system load indicators
        total_requests = sum(metrics.get('total_requests', 0) for metrics in monitoring.get_metrics().values())
        total_success_rate = health_status['summary']['total_success_rate']
        
        return {
            "status": "ok",
            "timestamp": time.time(),
            "uptime_seconds": round(uptime_seconds, 2),
            "uptime_human": _format_uptime(uptime_seconds),
            "system_load": {
                "total_requests": total_requests,
                "total_success_rate": total_success_rate,
                "healthy_services": health_status['summary']['healthy_services'],
                "degraded_services": health_status['summary']['degraded_services'],
                "unhealthy_services": health_status['summary']['unhealthy_services']
            },
            "recent_alerts": recent_alerts,
            "overall_status": health_status['overall_status'],
            "environment": config.ENVIRONMENT,
            "is_production": config.IS_PRODUCTION
        }
    except Exception as e:
        logger.error(f"System status retrieval failed: {e}")
        raise HTTPException(status_code=503, detail="System status retrieval failed")

def _format_uptime(seconds: float) -> str:
    """Format uptime in human-readable format"""
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if days > 0:
        return f"{days}d {hours}h {minutes}m {secs}s"
    elif hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    elif minutes > 0:
        return f"{minutes}m {secs}s"
    else:
        return f"{secs}s"
