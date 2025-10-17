from fastapi import APIRouter, Query, HTTPException, Depends, Request
from typing import Optional, Dict, Any
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from service.analytics_service import analytics_aggregation
from database.database import get_db
from models.models import ApiUsageLogs
from dependencies.dependencies import require_permissions

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/analytics/comprehensive")
async def get_comprehensive_analytics(
    hours: int = Query(24, description="Hours to analyze"),
    caller: Dict[str, Any] = Depends(require_permissions(["analytics.view"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    """Get comprehensive analytics including all metrics"""
    try:
        analytics = await analytics_aggregation.get_comprehensive_analytics(db, hours=hours)
        return {
            "status": "success",
            "data": analytics
        }
    except Exception as e:
        logger.error(f"Comprehensive analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/cost-breakdown")
async def get_cost_breakdown(
    hours: int = Query(24, description="Hours to analyze"),
    caller: Dict[str, Any] = Depends(require_permissions(["analytics.cost"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed cost breakdown by API and operation in USD and INR - CRITICAL endpoint, requires authentication"""
    try:
        cost_data = await analytics_aggregation.get_cost_breakdown(db, hours=hours)
        return {
            "status": "success",
            "data": cost_data
        }
    except Exception as e:
        logger.error(f"Cost breakdown error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/performance")
async def get_performance_metrics(
    hours: int = Query(24, description="Hours to analyze"),
    db: AsyncSession = Depends(get_db)
):
    """Get performance metrics including latency and accuracy"""
    try:
        performance = await analytics_aggregation.get_performance_metrics(db, hours=hours)
        return {
            "status": "success",
            "data": performance
        }
    except Exception as e:
        logger.error(f"Performance metrics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/medical")
async def get_medical_analysis(
    hours: int = Query(24, description="Hours to analyze"),
    db: AsyncSession = Depends(get_db)
):
    """Analyze medical vocabulary usage and accuracy"""
    try:
        medical_data = await analytics_aggregation.get_medical_analysis(db, hours=hours)
        return {
            "status": "success",
            "data": medical_data
        }
    except Exception as e:
        logger.error(f"Medical analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/summary")
async def get_analytics_summary(
    hours: int = Query(24, description="Hours to analyze"),
    db: AsyncSession = Depends(get_db)
):
    """Get a quick summary of key metrics"""
    try:
        analytics = await analytics_aggregation.get_comprehensive_analytics(db, hours=hours)
        
        # Extract key summary metrics
        summary = analytics['summary']
        api_breakdown = analytics['api_breakdown']
        
        # Find most expensive API
        most_expensive = max(api_breakdown, key=lambda x: x['cost_usd']) if api_breakdown else None
        
        # Find slowest API
        slowest = max(api_breakdown, key=lambda x: x['avg_latency_ms']) if api_breakdown else None
        
        # Find most accurate API
        most_accurate = max(api_breakdown, key=lambda x: x['avg_accuracy']) if api_breakdown else None
        
        return {
            "status": "success",
            "period_hours": hours,
            "summary": {
                "total_requests": summary['total_requests'],
                "total_cost_usd": summary['total_cost_usd'],
                "total_cost_inr": summary['total_cost_inr'],
                "avg_latency_ms": summary['avg_latency_ms'],
                "avg_accuracy": summary['avg_accuracy'],
                "error_rate": summary['error_rate'],
                "medical_terms_processed": summary['total_medical_terms']
            },
            "insights": {
                "most_expensive_api": most_expensive['api_type'] if most_expensive else None,
                "most_expensive_cost_usd": most_expensive['cost_usd'] if most_expensive else 0,
                "slowest_api": slowest['api_type'] if slowest else None,
                "slowest_latency_ms": slowest['avg_latency_ms'] if slowest else 0,
                "most_accurate_api": most_accurate['api_type'] if most_accurate else None,
                "most_accurate_score": most_accurate['avg_accuracy'] if most_accurate else 0
            }
        }
    except Exception as e:
        logger.error(f"Analytics summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/languages")
async def get_language_breakdown(
    hours: int = Query(24, description="Hours to analyze"),
    db: AsyncSession = Depends(get_db)
):
    """Get performance breakdown by language"""
    try:
        analytics = await analytics_aggregation.get_comprehensive_analytics(db, hours=hours)
        # For now, return empty language data since we don't have language-specific analytics yet
        language_data = []
        
        return {
            "status": "success",
            "period_hours": hours,
            "languages": language_data
        }
    except Exception as e:
        logger.error(f"Language breakdown error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/operations")
async def get_operation_breakdown(
    hours: int = Query(24, description="Hours to analyze"),
    db: AsyncSession = Depends(get_db)
):
    """Get performance breakdown by operation type"""
    try:
        analytics = await analytics_aggregation.get_comprehensive_analytics(db, hours=hours)
        # Extract operation data from API usage analytics
        api_usage = analytics.get('api_usage_analytics', {})
        operation_data = api_usage.get('by_service_type', [])
        
        return {
            "status": "success",
            "period_hours": hours,
            "operations": operation_data
        }
    except Exception as e:
        logger.error(f"Operation breakdown error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/request-rates")
async def get_request_rates(
    hours: int = Query(1, description="Hours to analyze for rate"),
    db: AsyncSession = Depends(get_db)
):
    """Get request rates per API and operation (requests/hour, alerts)."""
    try:
        data = await analytics_aggregation.get_performance_metrics(db, hours=hours)
        # Extract API performance data
        api_performance = data.get('api_performance', {})
        total_calls = api_performance.get('total_calls', 0)
        
        # Calculate rate
        rate = round(total_calls / max(1, hours), 2)
        alert = rate > 1000  # configurable threshold
        
        result = [{
            'api_type': 'all_apis',
            'requests': total_calls,
            'hours': hours,
            'requests_per_hour': rate,
            'alert': alert
        }]
        
        return { 'status': 'success', 'rates': result }
    except Exception as e:
        logger.error(f"Request rates error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/integration-performance")
async def get_integration_performance(
    hours: int = Query(24, description="Hours to analyze"),
    db: AsyncSession = Depends(get_db)
):
    """Get performance metrics grouped by integration"""
    try:
        performance = await analytics_aggregation.get_performance_metrics(db, hours=hours)
        
        # Extract performance data
        api_performance = performance.get('api_performance', {})
        session_performance = performance.get('session_performance', {})
        message_performance = performance.get('message_performance', {})
        
        result = {
            'api_integration': {
                'total_requests': api_performance.get('total_calls', 0),
                'avg_response_time_ms': api_performance.get('avg_response_time_ms', 0),
                'success_rate': api_performance.get('success_rate', 0)
            },
            'session_integration': {
                'total_sessions': session_performance.get('total_sessions', 0),
                'completion_rate': session_performance.get('completion_rate', 0),
                'avg_tokens_per_session': session_performance.get('avg_tokens_per_session', 0)
            },
            'message_integration': {
                'total_messages': message_performance.get('total_messages', 0),
                'avg_processing_time_ms': message_performance.get('avg_processing_time_ms', 0),
                'avg_message_length': message_performance.get('avg_message_length', 0)
            }
        }
        
        return {
            "status": "success",
            "period_hours": hours,
            "integration_performance": result
        }
    except Exception as e:
        logger.error(f"Integration performance error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/recent")
async def get_recent_requests(
    limit: int = Query(10, description="Number of recent requests to return"),
    db: AsyncSession = Depends(get_db)
):
    """Get recent API requests"""
    try:
        result = await db.execute(
            select(ApiUsageLogs).order_by(desc(ApiUsageLogs.timestamp)).limit(limit)
        )
        rows = result.scalars().all()

        def _operation_from_service(service_type: str) -> str:
            if not service_type:
                return "unknown"
            s = service_type.lower()
            if "stt" in s:
                return "stt"
            if "tts" in s:
                return "tts"
            if "chat" in s or "llm" in s or "openai" in s or "gpt" in s:
                return "chat"
            if "translate" in s or "translation" in s:
                return "translate"
            if "rag" in s or "retrieval" in s or "vector" in s:
                return "retrieval"
            return s

        recent_requests = []
        for r in rows:
            try:
                cost_usd = float(r.cost or 0)
            except Exception:
                cost_usd = 0.0
            recent_requests.append({
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "api_type": r.service_type,
                "operation": _operation_from_service(r.service_type or ""),
                "language": "",  # language not tracked in ApiUsageLogs
                "latency_ms": int(r.response_time_ms or 0),
                "cost_usd": cost_usd,
                "cost_inr": cost_usd * 83.0,
                "accuracy_score": 1.0 if (r.status or "success").lower() == "success" else 0.0,
                "medical_terms_count": 0,
                "error_message": None if (r.status or "success").lower() == "success" else (r.status or "error")
            })

        return {"status": "success", "recent_requests": recent_requests}
    except Exception as e:
        logger.error(f"Recent requests error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/integrations")
async def get_integration_analysis(
    hours: int = Query(24, description="Hours to analyze"),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed analysis of all integration APIs"""
    try:
        data = await analytics_aggregation.get_comprehensive_analytics(db, hours=hours)
        
        # Extract API usage data
        api_usage = data.get('api_usage_analytics', {})
        rag_analytics = data.get('rag_integration_analytics', {})
        
        # Group by integration
        integrations = {
            'openai': {'operations': ['llm'], 'total_cost': 0, 'total_requests': 0, 'avg_latency': 0, 'success_rate': 0},
            'deepgram': {'operations': ['stt', 'tts'], 'total_cost': 0, 'total_requests': 0, 'avg_latency': 0, 'success_rate': 0},
            'sarvam': {'operations': ['stt', 'tts', 'translate'], 'total_cost': 0, 'total_requests': 0, 'avg_latency': 0, 'success_rate': 0},
            'rag': {'operations': ['retrieval', 'vector_search'], 'total_cost': 0, 'total_requests': 0, 'avg_latency': 0, 'success_rate': 0}
        }
        
        # Update with actual data
        for item in api_usage.get('by_service_type', []):
            service_type = item.get('service_type', '').lower()
            if 'openai' in service_type or 'gpt' in service_type:
                integrations['openai']['total_cost'] += item.get('total_cost', 0)
                integrations['openai']['total_requests'] += item.get('call_count', 0)
                integrations['openai']['avg_latency'] = item.get('avg_response_time', 0)
            elif 'deepgram' in service_type:
                integrations['deepgram']['total_cost'] += item.get('total_cost', 0)
                integrations['deepgram']['total_requests'] += item.get('call_count', 0)
                integrations['deepgram']['avg_latency'] = item.get('avg_response_time', 0)
            elif 'sarvam' in service_type:
                integrations['sarvam']['total_cost'] += item.get('total_cost', 0)
                integrations['sarvam']['total_requests'] += item.get('call_count', 0)
                integrations['sarvam']['avg_latency'] = item.get('avg_response_time', 0)
        
        # Add RAG data
        integrations['rag']['total_cost'] = rag_analytics.get('total_rag_cost', 0)
        integrations['rag']['total_requests'] = rag_analytics.get('total_rag_api_calls', 0)
        integrations['rag']['avg_latency'] = rag_analytics.get('avg_rag_response_time', 0)
        
        return {
            "status": "success",
            "period_hours": hours,
            "integrations": integrations,
            "summary": {
                "total_requests": api_usage.get('total_api_calls', 0),
                "total_cost": api_usage.get('total_cost', 0),
                "success_rate": api_usage.get('success_rate', 0)
            }
        }
    except Exception as e:
        logger.error(f"Integration analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/debug")
async def debug_analytics(hours: int = Query(24, description="Hours to analyze")):
    """Debug endpoint to check raw database data"""
    try:
        return {
            "status": "disabled",
            "message": "Database-backed analytics debug is disabled"
        }
    except Exception as e:
        logger.error(f"Debug error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analytics/cleanup")
async def cleanup_old_data(days: int = Query(30, description="Days of data to keep")):
    """Clean up old data to free up space"""
    try:
        return {
            "status": "disabled",
            "message": "Database cleanup is disabled"
        }
    except Exception as e:
        logger.error(f"Data cleanup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/consultation/{consultation_id}")
async def get_consultation_analytics(
    consultation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get analytics for a specific consultation"""
    try:
        # Use service layer function
        analytics_data = await analytics_aggregation.get_single_consultation_analytics(db, consultation_id)
        
        if "error" in analytics_data:
            if analytics_data["error"] == "Consultation not found":
                raise HTTPException(status_code=404, detail="Consultation not found")
            else:
                raise HTTPException(status_code=500, detail=analytics_data["error"])
        
        return {
            "status": "success",
            **analytics_data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting consultation analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analytics/event")
async def log_analytics_event(
    request: Request,
    caller: Dict[str, Any] = Depends(require_permissions(["analytics.log"], allow_super_admin=True)),
    db: AsyncSession = Depends(get_db)
):
    """Log analytics event from frontend"""
    try:
        data = await request.json()
        
        # Log the event
        logger.info(f"Analytics event: {data.get('event')} - {data.get('data')}")
        
        # Optionally store in database if needed
        # For now, just acknowledge receipt
        
        return {"status": "success", "message": "Event logged"}
    except Exception as e:
        logger.error(f"Error logging analytics event: {e}")
        raise HTTPException(status_code=500, detail=str(e))