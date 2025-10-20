import os
os.environ['PYTHONIOENCODING'] = 'utf-8'
import sys
import io

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from starlette.middleware.base import BaseHTTPMiddleware
import time
import logging

logger = logging.getLogger(__name__)
from logging.handlers import RotatingFileHandler
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse, PlainTextResponse, ORJSONResponse, HTMLResponse
from fastapi import HTTPException
from starlette.requests import Request as StarletteRequest

# Existing routes
# from routes.routes_stt_tts_tests import router as ai_test_router
from routes.routes_conversation import router as conversation_router
from routes.routes_unified_analytics import router as unified_analytics_router
from routes.routes_websocket_streaming import router as websocket_streaming_router
from routes.routes_rag import router as rag_router

# New routers
from routes import patients_router, auth_router, hospital_router, doctors_router, search_router, superadmin_router, hospital_admin_routers

# Dependencies and error handling
from dependencies.middleware import register_middleware
from centralisedErrorHandling.ErrorHandling import UserServiceError

from config import settings

# Import unified services for backward compatibility
from integrations.unified_services import sarvam_service, openai_service, deepgram_service

# Import monitoring health check router
from monitoring import health_check_router

app = FastAPI(
    title="AI Avatar Doctor Backend",
    version="1.0.0",
    docs_url="/docs",
    default_response_class=ORJSONResponse,
)

def _configure_logging():
    log_dir = os.path.join(os.getcwd(), "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "app.log")

    formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)s %(name)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    file_handler = RotatingFileHandler(log_path, maxBytes=5_000_000, backupCount=3, encoding='utf-8')
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    # Ensure stdout is UTF-8 on Windows consoles
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    # Wrap stdout explicitly with UTF-8 if needed
    text_stdout = sys.stdout
    try:
        if not getattr(sys.stdout, 'encoding', '').lower().startswith('utf'):
            text_stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        # Fallback to original stdout if wrapping fails
        text_stdout = sys.stdout

    stream_handler = logging.StreamHandler(text_stdout)
    stream_handler.setFormatter(formatter)
    stream_handler.setLevel(logging.INFO)

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    # Avoid duplicate handlers when reloading
    existing = {type(h) for h in root.handlers}
    if RotatingFileHandler not in existing:
        root.addHandler(file_handler)
    if logging.StreamHandler not in existing:
        root.addHandler(stream_handler)

_configure_logging()

logger = logging.getLogger("api")

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.time()
        # Avoid eagerly reading body to reduce latency and memory pressure
        content_length = request.headers.get("content-length")
        logger.info(
            f"REQ {request.method} {request.url.path} query={dict(request.query_params)} content_length={content_length}"
        )
        
        try:
            response = await call_next(request)
        except Exception as e:
            logger.error(f"Error processing request: {e}")
            # Ensure CORS headers are set even on error
            from fastapi.responses import JSONResponse
            response = JSONResponse(
                status_code=500,
                content={"detail": str(e)},
                headers={
                    "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
                    "Access-Control-Allow-Credentials": "true",
                }
            )
            
        duration_ms = int((time.time() - start) * 1000)
        logger.info(
            f"RES {request.method} {request.url.path} status={response.status_code} duration_ms={duration_ms}"
        )
        return response

# CORS - Must be added FIRST before other middleware
origins = getattr(settings, "CORS_ORIGINS", ["*"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],  # Explicit origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# HTTP compression (helps on JSON responses and static assets)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Trusted Host Middleware
if getattr(settings, "ENFORCE_TRUSTED_IPS", False):
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"]
    )

# Trusted IP Middleware
TRUSTED_IPS = ["127.0.0.1", "::1"]

if getattr(settings, "ENFORCE_TRUSTED_IPS", False):
    @app.middleware("http")
    async def trusted_ip_middleware(request: Request, call_next):
        ip = str(request.client.host) if request.client else "unknown"
        path = request.url.path or "/"
        if path in ("/docs", "/redoc", "/openapi.json"):
            return await call_next(request)
        if ip not in TRUSTED_IPS:
            return JSONResponse(content="403 - Forbidden: Access is denied", status_code=403)
        return await call_next(request)

# Register custom middleware
register_middleware(app)

# Add existing logging middleware
app.add_middleware(LoggingMiddleware)

# Existing routers
# app.include_router(ai_test_router, prefix="/api/v1", tags=["AI Tests"])
app.include_router(conversation_router, prefix="/api/v1", tags=["Conversation"])
app.include_router(unified_analytics_router, prefix="/api/v1", tags=["Unified Analytics"])
app.include_router(websocket_streaming_router, prefix="/api/v1", tags=["WebSocket Streaming"])
app.include_router(rag_router, prefix="/api/v1", tags=["RAG"])

# New routers
app.include_router(patients_router.router)
app.include_router(auth_router.router)
app.include_router(hospital_router.router)

# Add direct thank you route for testing
@app.get("/thank-you", response_class=HTMLResponse)
async def thank_you_page_direct():
    """Direct thank you page route"""
    try:
        with open("templates/thank_you.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        logger.error(f"Error serving thank you page: {e}")
        raise HTTPException(status_code=500, detail=str(e))
app.include_router(doctors_router.router)
app.include_router(search_router.router)
app.include_router(superadmin_router.router)
app.include_router(hospital_admin_routers.router)

# Include monitoring health check router
app.include_router(health_check_router, prefix="/api/v1", tags=["Monitoring"])

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Lightweight cache headers for static assets
@app.middleware("http")
async def _static_cache_middleware(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path or "/"
    if path.startswith("/static/"):
        # Cache for 7 days; adjust per deployment needs
        response.headers.setdefault("Cache-Control", "public, max-age=604800, immutable")
    return response

@app.get("/")
async def index(request: Request):
    """Root route - redirect to login page for authentication"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/login")

@app.get("/login", response_class=HTMLResponse)
async def login_page():
    """Serve the login page"""
    try:
        with open("templates/login.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        logger.error(f"Error serving login page: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/consultation-form", response_class=HTMLResponse)
async def consultation_form_page():
    """Serve the consultation form page - requires authentication"""
    try:
        with open("templates/consultation_form.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        logger.error(f"Error serving consultation form page: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/conversation", response_class=HTMLResponse)
async def conversation():
    """Serve the conversation page"""
    try:
        with open("templates/conversation.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        logger.error(f"Error serving conversation page: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics")
async def analytics_dashboard(request: Request):
    return templates.TemplateResponse("unified_analytics.html", {"request": request})

@app.get("/analytics-simple")
async def analytics_dashboard_simple(request: Request):
    return templates.TemplateResponse("analytics_simple.html", {"request": request})

@app.get("/test-charts")
async def test_charts(request: Request):
    return templates.TemplateResponse("test_charts.html", {"request": request})

@app.get("/analytics-debug")
async def analytics_debug(request: Request):
    return templates.TemplateResponse("analytics_debug.html", {"request": request})

 

@app.get("/favicon.ico")
async def favicon():
    # Avoid 404s; return no content
    from fastapi import Response
    return Response(status_code=204)

@app.get("/health")
async def health_check():
    # Optional DB connectivity check
    from sqlalchemy import text
    from database.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as s:
            await s.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception as e:
        return {"status": "degraded", "db": str(e)}

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: StarletteRequest, exc: Exception):
    logging.exception("Unhandled error: %s", exc)

    # If it's a known UserServiceError, return structured JSON (message, code, context)
    if isinstance(exc, UserServiceError):
        payload = {
            "error": exc.__class__.__name__,
            "message": getattr(exc, "message", str(exc)),
            "error_code": getattr(exc, "error_code", None),
            "context": getattr(exc, "context", {}) or {},
        }
        return JSONResponse(status_code=400, content=payload)

    if getattr(settings, "SHOW_ERRORS", True):
        return PlainTextResponse(str(exc), status_code=500)
    return PlainTextResponse("Internal Server Error", status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)