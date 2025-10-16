import os
os.environ['PYTHONIOENCODING'] = 'utf-8'
import sys
import io

from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
import time
import logging
from logging.handlers import RotatingFileHandler
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse, PlainTextResponse, ORJSONResponse
from starlette.requests import Request as StarletteRequest

# Essential routers only
from routes import patients_router, auth_router, hospital_router, doctors_router, search_router, superadmin_router, hospital_admin_routers

# Dependencies and error handling
from dependencies.middleware import register_middleware
from centralisedErrorHandling.ErrorHandling import UserServiceError

from config import settings

# Create FastAPI app
app = FastAPI(
    title="Hospital Management System API",
    description="API for Hospital Management System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
origins = getattr(settings, "CORS_ORIGINS", ["*"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Essential routers only
app.include_router(patients_router.router)
app.include_router(auth_router.router)
app.include_router(hospital_router.router)
app.include_router(doctors_router.router)
app.include_router(search_router.router)
app.include_router(superadmin_router.router)
app.include_router(hospital_admin_routers.router)

# Health check endpoint
@app.get("/")
async def root():
    return {"message": "Hospital Management System API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
