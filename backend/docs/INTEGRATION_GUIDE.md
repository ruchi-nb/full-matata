# 🔧 Integration Guide

## Quick Start

### 1. Update Main Application

Add the health check routes to your main FastAPI app:

```python
# In your main.py or app.py
from routes.health_routes import router as health_router

app.include_router(health_router)
```

### 2. Update Service Imports

Replace old service imports with the new service manager:

```python
# Old imports
from integrations.unified_services import sarvam_service, deepgram_service, openai_service

# New imports
from integrations.service_manager import service_manager

# Usage
sarvam_service = service_manager.get_service('sarvam')
deepgram_service = service_manager.get_service('deepgram')
openai_service = service_manager.get_service('openai', 'chat')
rag_service = service_manager.get_service('rag', 'service')
```

### 3. Environment Variables

Add these environment variables to your `.env` file:

```bash
# Production Configuration
ENVIRONMENT=production
ENABLE_METRICS=true
ENABLE_RATE_LIMITING=true
ENABLE_CIRCUIT_BREAKER=true

# Service Rate Limits
SARVAM_RATE_LIMIT=60
DEEPGRAM_RATE_LIMIT=100
OPENAI_RATE_LIMIT=1000
RAG_RATE_LIMIT=200

# Circuit Breaker Settings
SARVAM_MAX_FAILURES=5
DEEPGRAM_MAX_FAILURES=5
OPENAI_MAX_FAILURES=10
RAG_MAX_FAILURES=5
```

## 🎯 Key Benefits

### ✅ What's Been Enhanced

1. **Centralized Configuration** - All settings in one place
2. **Production Monitoring** - Real-time metrics and alerts
3. **Circuit Breaker Pattern** - Prevents cascading failures
4. **Rate Limiting** - Prevents API overuse
5. **Health Checks** - Built-in service health monitoring
6. **Input Validation** - Comprehensive validation for all inputs
7. **Error Handling** - Consistent error handling across services
8. **Performance Tracking** - Detailed performance metrics

### 🔄 Backward Compatibility

The system maintains backward compatibility with your existing code:

```python
# This still works
from integrations.unified_services import sarvam_service
result = await sarvam_service.text_translate("Hello", "en", "hi")

# But now you can also use
from integrations.service_manager import service_manager
translation_service = service_manager.get_service('sarvam', 'translation')
result = await translation_service.text_translate_async("Hello", "en", "hi")
```

## 📊 Monitoring Dashboard

Access your new monitoring endpoints:

- **System Health**: `GET /health/`
- **Service Health**: `GET /health/services`
- **Metrics**: `GET /health/metrics`
- **Alerts**: `GET /health/alerts`
- **Performance Trends**: `GET /health/trends/sarvam`

## 🚀 Next Steps

1. **Deploy the enhanced system**
2. **Monitor the health endpoints**
3. **Adjust rate limits based on usage**
4. **Set up alerting for critical issues**
5. **Review performance trends regularly**

Your system is now **production-ready** with enterprise-grade monitoring and reliability! 🎉
