from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from typing import List, Union
from enum import Enum


class LogLevel(str, Enum):
    CRITICAL = "CRITICAL"
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"
    DEBUG = "DEBUG"
    NOTSET = "NOTSET"


class Settings(BaseSettings):
    DATABASE_URL: str
    GEMINI_API_KEY: str
    HEYGEN_API_KEY: str
    SARVAM_API_KEY: str
    OPENAI_API_KEY: str
    DEEPGRAM_API_KEY: str

    # Removed unnecessary fields: EMBEDDING_MODEL, LLM_MODEL, TTS_VOICE_DEFAULT
    OPENAI_MODEL: str = "gpt-4o-mini"
    

    # Chat Provider Configuration - Production Optimized
    CHAT_PROVIDER: str = "openai"  # "openai" or "gemini"
    GEMINI_MODEL: str = "gemini-2.0-flash"
    
    # Production Performance Optimizations
    OPENAI_TIMEOUT: float = 10.0
    OPENAI_MAX_RETRIES: int = 1
    RAG_TIMEOUT: float = 8.0
    RAG_MAX_RETRIES: int = 1



    HOST: str = "0.0.0.0"
    PORT: int = 8000

    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    CORS_ORIGINS: List[str] = Field(default_factory=lambda: ["*"])

    API_VERSION: str = "v1"

    RATE_LIMIT_PER_MINUTE: int = 60

    LOG_LEVEL: LogLevel = LogLevel.INFO

    ALLOW_DOCS_CSP_EXCEPTION: bool = True

    # Default Swagger UI CSP sources
    DOCS_CSP_SCRIPT_SOURCES: Union[str, List[str]] = ""
    DOCS_CSP_STYLE_SOURCES: Union[str, List[str]] = ""
    DOCS_CSP_FONT_SOURCES: Union[str, List[str]] = ""   

    # External CSP sources (for any additional scripts/styles)
    EXTERNAL_SCRIPT_SOURCES: Union[str, List[str]] = ""
    EXTERNAL_STYLE_SOURCES: Union[str, List[str]] = ""

    # Validators to convert space-separated strings into lists
    @field_validator(
        "DOCS_CSP_SCRIPT_SOURCES", 
        "DOCS_CSP_STYLE_SOURCES", 
        "DOCS_CSP_FONT_SOURCES",     
        "EXTERNAL_SCRIPT_SOURCES", 
        "EXTERNAL_STYLE_SOURCES",
        mode="before"
    )
    def split_str(cls, v):
        if isinstance(v, str):
            return v.split()  #
        return v

    # OAuth
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    SECRET_KEY: str

    # JWT Configuration
    JWT_SECRET: str = "dev-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRY_SECONDS: int = 4000
    JTI_EXPIRY_SECONDS: int = 3600
    ENFORCE_TRUSTED_IPS: bool = False
    SHOW_ERRORS: bool = True

    # Sarvam Streaming defaults
    SARVAM_DEFAULT_LANGUAGE_CODE: str = "en-IN"
    SARVAM_STT_MODEL: str = "saarika:v2.5"
    SARVAM_HIGH_VAD_SENSITIVITY: bool = True
    SARVAM_VAD_SIGNALS: bool = True
    SARVAM_SAMPLE_RATE: int = 16000

    # Deepgram Configuration
    DEEPGRAM_BASE_URL: str = "https://api.deepgram.com/v1"
    DEEPGRAM_TTS_BASE_URL: str = "https://api.deepgram.com/v1"
    DEEPGRAM_TTS_VOICE: str = "aura-kathleen-en"
    DEEPGRAM_TTS_STREAMING_VOICE: str = "aura-2-thalia-en"
    DEEPGRAM_STT_MODEL: str = "nova-3-general"

    # Sarvam Configuration
    SARVAM_BASE_URL: str = "https://api.sarvam.ai"
    SARVAM_STT_MODEL: str = "saarika:v2.5"
    SARVAM_TTS_MODEL: str = "bulbul:v2"
    SARVAM_TTS_SPEAKER: str = "karun"
    SARVAM_TRANSLATE_MODEL: str = "sarvam-translate:v1"
    SARVAM_TRANSLATE_MODE: str = "formal"

    # RAG Configuration
    RAG_MAX_CHARS: int = 4000
    RAG_K_CHUNKS: int = 5
    RAG_MAX_TOKENS: int = 300
    RAG_TEMPERATURE: float = 0.3

    # OpenAI Configuration
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MAX_TOKENS: int = 300
    OPENAI_TEMPERATURE: float = 0.3
    OPENAI_TOP_P: float = 0.9

    # Celery / Redis
    # CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    # CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    # CELERY_TASK_DEFAULT_QUEUE: str = "default"
    
    # Redis for session management
    REDIS_URL: str = "redis://localhost:6379/2"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # Observability
    SENTRY_DSN: str = ""

    # ffmpeg_path: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()




# from pydantic_settings import BaseSettings, SettingsConfigDict
# from pydantic import Field, field_validator
# from typing import List, Union
# from enum import Enum


# class LogLevel(str, Enum):
#     CRITICAL = "CRITICAL"
#     ERROR = "ERROR"
#     WARNING = "WARNING"
#     INFO = "INFO"
#     DEBUG = "DEBUG"
#     NOTSET = "NOTSET"

# class Settings(BaseSettings):
#     DATABASE_URL: str
#     # SYNC_DATABASE_URL: str

#     GEMINI_API_KEY: str
#     HEYGEN_API_KEY: str
#     SARVAM_API_KEY: str
#     OPENAI_API_KEY: str
#     DEEPGRAM_API_KEY: str

#     EMBEDDING_MODEL: str
#     LLM_MODEL: str
#     TTS_VOICE_DEFAULT: str
#     OPENAI_MODEL: str = "gpt-4o-mini"

#     HOST: str = "0.0.0.0"
#     PORT: int = 8000

#     ENVIRONMENT: str = "development"
#     DEBUG: bool = True

#     CORS_ORIGINS: List[str] = Field(default_factory=lambda: ["*"])

#     API_VERSION: str = "v1"

#     RATE_LIMIT_PER_MINUTE: int = 60

#     LOG_LEVEL: LogLevel = LogLevel.INFO

#     ALLOW_DOCS_CSP_EXCEPTION: bool = True

#     # Default Swagger UI CSP sources
#     DOCS_CSP_SCRIPT_SOURCES: Union[str, List[str]] = ""
#     DOCS_CSP_STYLE_SOURCES: Union[str, List[str]] = ""
#     DOCS_CSP_FONT_SOURCES: Union[str, List[str]] = ""   # ✅ Added this

#     # External CSP sources (for any additional scripts/styles)
#     EXTERNAL_SCRIPT_SOURCES: Union[str, List[str]] = ""
#     EXTERNAL_STYLE_SOURCES: Union[str, List[str]] = ""

#     # Validators to convert space-separated strings into lists
#     @field_validator(
#         "DOCS_CSP_SCRIPT_SOURCES", 
#         "DOCS_CSP_STYLE_SOURCES", 
#         "DOCS_CSP_FONT_SOURCES",     
#         "EXTERNAL_SCRIPT_SOURCES", 
#         "EXTERNAL_STYLE_SOURCES",
#         mode="before"
#     )
#     def split_str(cls, v):
#         if isinstance(v, str):
#             return v.split()  #
#         return v

#     # OAuth
#     GOOGLE_CLIENT_ID: str
#     GOOGLE_CLIENT_SECRET: str
#     SECRET_KEY: str

#     # JWT Configuration
#     JWT_SECRET: str = "dev-secret"
#     JWT_ALGORITHM: str = "HS256"
#     ACCESS_TOKEN_EXPIRY_SECONDS: int = 4000
#     JTI_EXPIRY_SECONDS: int = 3600
#     ENFORCE_TRUSTED_IPS: bool = False
#     SHOW_ERRORS: bool = True

#     # Sarvam Streaming defaults
#     SARVAM_DEFAULT_LANGUAGE_CODE: str = "en-IN"
#     SARVAM_STT_MODEL: str = "saarika:v2.5"
#     SARVAM_HIGH_VAD_SENSITIVITY: bool = True
#     SARVAM_VAD_SIGNALS: bool = True
#     SARVAM_SAMPLE_RATE: int = 16000

#     # Celery / Redis
#     CELERY_BROKER_URL: str = "redis://localhost:6379/0"
#     CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
#     CELERY_TASK_DEFAULT_QUEUE: str = "default"
    
#     # Redis for session management
#     REDIS_URL: str = "redis://localhost:6379/2"
#     REDIS_HOST: str = "localhost"
#     REDIS_PORT: int = 6379

#     # Observability
#     SENTRY_DSN: str = ""

#     # ffmpeg_path: str

#     model_config = SettingsConfigDict(env_file=".env", extra="ignore")


# settings = Settings()
