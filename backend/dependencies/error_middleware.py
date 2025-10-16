"""
Error Handling Middleware
Maps centralized errors to appropriate HTTP responses
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

from centralisedErrorHandling.ErrorHandling import (
    UserServiceError,
    ValidationError,
    DatabaseError,
    UserNotFoundError,
    AuthenticationError,
    AuthorizationError,
    SessionError,
    TransactionError,
    ConnectionError,
    DataIntegrityError,
    ResourceNotFoundError
)

logger = logging.getLogger(__name__)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware to catch centralized errors and convert to appropriate HTTP responses"""
    
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        
        except ValidationError as e:
            logger.warning(f"Validation error: {e.user_message}")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "error": "Validation Error",
                    "message": e.user_message,
                    "details": {
                        "field": getattr(e, 'field', None),
                        "value": getattr(e, 'value', None)
                    } if hasattr(e, 'field') else None
                }
            )
        
        except AuthenticationError as e:
            logger.warning(f"Authentication error: {e.user_message}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "error": "Authentication Error",
                    "message": e.user_message
                },
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        except AuthorizationError as e:
            logger.warning(f"Authorization error: {e.user_message}")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "error": "Authorization Error",
                    "message": e.user_message
                }
            )
        
        except (UserNotFoundError, ResourceNotFoundError) as e:
            logger.warning(f"Resource not found: {e.user_message}")
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "error": "Not Found",
                    "message": e.user_message,
                    "resource_type": getattr(e, 'resource_type', None),
                    "resource_id": getattr(e, 'resource_id', None)
                }
            )
        
        except DataIntegrityError as e:
            logger.error(f"Data integrity error: {e}")
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={
                    "error": "Data Integrity Error",
                    "message": "The operation conflicts with existing data",
                    "details": {
                        "constraint_type": getattr(e, 'constraint_type', None),
                        "table": getattr(e, 'table', None)
                    } if hasattr(e, 'constraint_type') else None
                }
            )
        
        except (ConnectionError, TransactionError, SessionError) as e:
            logger.error(f"Database/service error: {e}", exc_info=True)
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Service Unavailable",
                    "message": "The service is temporarily unavailable. Please try again later.",
                    "retry_after": 30  # seconds
                },
                headers={"Retry-After": "30"}
            )
        
        except DatabaseError as e:
            logger.error(f"Database error: {e}", exc_info=True)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Internal Server Error",
                    "message": "An unexpected error occurred. Please contact support."
                }
            )
        
        except UserServiceError as e:
            # Catch-all for other custom errors
            logger.error(f"Service error: {e}", exc_info=True)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Service Error",
                    "message": e.user_message or "An unexpected error occurred."
                }
            )
        
        except Exception as e:
            # Unexpected errors
            logger.error(f"Unexpected error: {e}", exc_info=True)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Internal Server Error",
                    "message": "An unexpected error occurred. Please contact support."
                }
            )


def setup_error_handlers(app):
    """Setup global error handlers for the FastAPI app"""
    from fastapi.exceptions import RequestValidationError
    from starlette.exceptions import HTTPException as StarletteHTTPException
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle FastAPI validation errors"""
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "Validation Error",
                "message": "Invalid request data",
                "details": exc.errors()
            }
        )
    
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        """Handle HTTP exceptions"""
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.detail,
                "message": exc.detail
            }
        )

