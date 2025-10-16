# AI Avatar Doctor Backend 🏥

> An intelligent AI-powered virtual doctor system with multilingual support, real-time voice interaction, RAG-enhanced medical knowledge, and comprehensive analytics.

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Database Schema](#database-schema)
- [API Flow Diagrams](#api-flow-diagrams)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Analytics & Monitoring](#analytics--monitoring)
- [Error Handling](#error-handling)
- [License](#license)

---

## 🎯 Overview

**AI Avatar Doctor** is a production-ready FastAPI backend system that powers virtual doctor consultations with:
- **Real-time voice consultations** with bidirectional streaming
- **Multilingual support** (English, Hindi, and regional Indian languages)
- **RAG-enhanced medical knowledge** for accurate responses
- **Comprehensive analytics** tracking costs, latency, and usage
- **Role-based access control** for hospitals, doctors, and patients
- **Audit logging** for compliance and debugging

---

## ✨ Key Features

### 🎙️ Voice & Text Conversations
- **Real-time WebSocket streaming** for low-latency voice interactions
- **Multi-provider STT**: Deepgram (English) and Sarvam (Indian languages)
- **Multi-provider TTS**: Deepgram and Sarvam with streaming support
- **Translation services** for seamless multilingual consultations

### 🧠 AI-Powered Intelligence
- **OpenAI GPT-4o-mini** for medical conversations
- **RAG (Retrieval-Augmented Generation)** with ChromaDB for medical knowledge
- **Context-aware responses** with conversation history
- **Smart utterance detection** to optimize API calls

### 📊 Analytics & Monitoring
- **Real-time cost tracking** for all API calls (OpenAI, Deepgram, Sarvam)
- **Latency monitoring** with millisecond precision
- **Token usage tracking** with automatic session aggregation
- **Comprehensive dashboards** with charts and metrics

### 🔐 Enterprise Features
- **Multi-hospital support** with isolated data
- **Role-based permissions** (Platform Admin, Hospital Admin, Doctor, Patient)
- **JWT authentication** with refresh tokens
- **Audit logging** for all critical operations
- **Redis-based session management**

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │   Web    │  │  Mobile  │  │WebSocket │  │   REST   │          │
│  │ Browser  │  │   App    │  │  Client  │  │   API    │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
└───────┼─────────────┼─────────────┼─────────────┼─────────────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                      │
        ┌─────────────▼──────────────────────────────────────────────┐
        │            FASTAPI APPLICATION LAYER                       │
        │  ┌──────────────────────────────────────────────────────┐ │
        │  │              MIDDLEWARE STACK                        │ │
        │  │  • CORS • GZip • Logging • Error Handler • JWT Auth │ │
        │  └──────────────────────────────────────────────────────┘ │
        │                                                            │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
        │  │   Auth   │  │Consult.  │  │WebSocket │  │   RAG    │ │
        │  │  Router  │  │  Router  │  │  Router  │  │  Router  │ │
        │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
        └───────┼─────────────┼─────────────┼─────────────┼────────┘
                │             │             │             │
        ┌───────▼─────────────▼─────────────▼─────────────▼────────┐
        │              SERVICE LAYER (Business Logic)              │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
        │  │   Auth   │  │Consult.  │  │Analytics │  │   RAG    │ │
        │  │ Service  │  │ Service  │  │ Service  │  │ Service  │ │
        │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
        └───────┼─────────────┼─────────────┼─────────────┼────────┘
                │             │             │             │
        ┌───────▼─────────────▼─────────────▼─────────────▼────────┐
        │           INTEGRATION LAYER (External Services)          │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
        │  │  OpenAI  │  │ Deepgram │  │  Sarvam  │  │ ChromaDB │ │
        │  │   GPT    │  │ STT/TTS  │  │ STT/TTS  │  │   RAG    │ │
        │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
        └───────┼─────────────┼─────────────┼─────────────┼────────┘
                │             │             │             │
        ┌───────▼─────────────▼─────────────▼─────────────▼────────┐
        │              DATA LAYER                                  │
        │  ┌──────────────────┐         ┌──────────────────┐      │
        │  │  MySQL Database  │         │  Redis Cache     │      │
        │  │  (SQLAlchemy)    │         │  (Sessions)      │      │
        │  └──────────────────┘         └──────────────────┘      │
        └──────────────────────────────────────────────────────────┘
```

### Consultation Flow Architecture

```mermaid
sequenceDiagram
    participant C as Client
    participant API as FastAPI
    participant DB as Database
    participant STT as STT Service
    participant LLM as OpenAI
    participant RAG as RAG Service
    participant TTS as TTS Service
    participant Analytics as Analytics Service

    C->>API: Create Consultation
    API->>DB: Create consultation record
    API->>DB: Create session
    API-->>C: consultation_id, session_id

    C->>API: Send audio (WebSocket/HTTP)
    API->>STT: Transcribe audio
    STT-->>API: Transcript
    API->>Analytics: Log STT usage (cost, latency, tokens)

    API->>RAG: Retrieve medical context
    RAG-->>API: Relevant medical knowledge
    API->>Analytics: Log RAG usage

    API->>LLM: Generate response
    LLM-->>API: AI response
    API->>Analytics: Log LLM usage (tokens, cost)

    API->>TTS: Generate audio
    TTS-->>API: Audio stream
    API->>Analytics: Log TTS usage

    API->>DB: Save messages
    API->>DB: Update session stats
    API-->>C: Response (text + audio)
```

---

## 🛠️ Technology Stack

### Backend Framework
- **FastAPI** - Modern async web framework
- **Uvicorn** - ASGI server with WebSocket support
- **Pydantic** - Data validation and settings management
- **SQLAlchemy 2.0** - Async ORM for database operations

### AI & ML Services
- **OpenAI GPT-4o-mini** - Conversational AI
- **Deepgram** - STT/TTS (English)
- **Sarvam AI** - STT/TTS (Indian languages)
- **ChromaDB** - Vector database for RAG
- **Sentence Transformers** - Text embeddings

### Database & Caching
- **MySQL** - Primary relational database
- **Redis** - Session management and caching
- **AsyncIO** - Async database connections

### Monitoring & Logging
- **Python Logging** - Structured logging with rotation
- **Sentry** - Error tracking (optional)
- **Custom Analytics** - Built-in cost/latency tracking

---

## 💾 Database Schema

### Core Tables

```sql
-- Users and Authentication
users
├── user_id (PK)
├── username (UNIQUE)
├── email (UNIQUE)
├── password_hash
├── global_role_id (FK → role_master)
└── timestamps

user_details
├── user_id (PK, FK → users)
├── first_name, last_name
├── dob, gender, phone
└── address

-- Hospitals and Roles
hospital_master
├── hospital_id (PK)
├── hospital_name (UNIQUE)
├── hospital_email, admin_contact
└── timestamps

hospital_role
├── hospital_role_id (PK)
├── hospital_id (FK)
├── role_name
├── parent_hospital_role_id (FK, self-referencing)
└── timestamps

-- Consultations
consultation
├── consultation_id (PK)
├── patient_id (FK → users)
├── doctor_id (FK → users)
├── specialty_id (FK → specialties)
├── hospital_id (FK → hospital_master)
├── status, consultation_type
└── total_duration

consultation_sessions
├── session_id (PK)
├── consultation_id (FK)
├── session_type (text/voice/video)
├── total_tokens_used
├── total_api_calls
└── session_start, session_end

consultation_messages
├── message_id (PK)
├── session_id (FK)
├── sender_type (patient/assistant)
├── message_text, audio_url
└── processing_time_ms

-- Analytics
api_usage_logs
├── usage_id (PK)
├── service_type (openai_chat, deepgram_stt, etc.)
├── session_id (FK)
├── doctor_id, patient_id, hospital_id (FK)
├── tokens_used, api_calls
├── cost, response_time_ms
└── timestamp

-- Audit
audit_logs
├── audit_id (PK)
├── event_type
├── entity_type, entity_id
├── user_actor (FK → users)
├── old_values, new_values (JSON)
└── event_time
```

### Entity Relationships

```
users ──┬── consultation (as patient)
        ├── consultation (as doctor)
        ├── user_details
        ├── hospital_user_roles
        └── api_usage_logs

hospital_master ──┬── consultation
                  ├── hospital_role
                  ├── hospital_user_roles
                  └── api_usage_logs

consultation ──┬── consultation_sessions
               └── consultation_transcripts

consultation_sessions ──┬── consultation_messages
                        └── api_usage_logs
```

---

## 🔄 API Flow Diagrams

### 1. Text Conversation Flow

```
┌─────────────┐
│   Client    │
│  sends text │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  POST /api/v1/conversation/message  │
│  Body: text, session_id             │
└──────┬──────────────────────────────┘
       │
       ▼
┌────────────────────────────────────┐
│  Service Layer Processing          │
│  1. Validate session               │
│  2. Check trivial utterance        │
│  3. RAG retrieval (if needed)      │
│  4. OpenAI chat completion         │
│  5. Save to database               │
└──────┬─────────────────────────────┘
       │
       ├──────────────────┐
       │                  │
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│ Analytics    │   │  Database    │
│ • Log tokens │   │ • Messages   │
│ • Log cost   │   │ • Tokens     │
│ • Log latency│   │ • Duration   │
└──────────────┘   └──────────────┘
       │
       ▼
┌─────────────────────────┐
│  Response to Client     │
│  • AI response text     │
│  • Metrics              │
│  • Session data         │
└─────────────────────────┘
```

### 2. Voice Conversation Flow (WebSocket)

```
┌─────────┐
│ Client  │
│connects │
└────┬────┘
     │
     ▼
┌─────────────────────────────────────┐
│  WebSocket /api/v1/ws/streaming     │
│  Connection established             │
└──────┬──────────────────────────────┘
       │
       ├─ Message: {"type": "init-session", "consultation_id": 123}
       │
       ▼
┌──────────────────────────────────┐
│  Initialize Session              │
│  • Create/get DB session         │
│  • Initialize STT connection     │
│  • Set language preference       │
└──────┬───────────────────────────┘
       │
       ├─ Message: {"type": "audio", "data": base64_audio}
       │
       ▼
┌───────────────────────────────────────────────────────┐
│  Audio Processing Pipeline                            │
│                                                        │
│  1. Receive audio chunk (base64)                      │
│  2. Decode and validate audio                         │
│  3. Send to STT service (streaming)                   │
│     │                                                  │
│     ▼                                                  │
│  ┌─────────────────────────────────────┐             │
│  │  STT Processing                     │             │
│  │  • Deepgram (English)               │             │
│  │  • Sarvam (Hindi/regional)          │             │
│  │  • Real-time transcription          │             │
│  └──────────┬──────────────────────────┘             │
│             │                                          │
│             ▼                                          │
│  Send partial transcript to client                    │
│  {"type": "transcript", "text": "...", "is_final": false}
│                                                        │
│  4. On final transcript:                              │
│     │                                                  │
│     ▼                                                  │
│  ┌─────────────────────────────────────┐             │
│  │  RAG Context Retrieval (if needed)  │             │
│  │  • Query ChromaDB                   │             │
│  │  • Get top-k relevant chunks        │             │
│  └──────────┬──────────────────────────┘             │
│             │                                          │
│             ▼                                          │
│  ┌─────────────────────────────────────┐             │
│  │  OpenAI Chat Completion             │             │
│  │  • Build prompt with context        │             │
│  │  • Stream GPT response              │             │
│  └──────────┬──────────────────────────┘             │
│             │                                          │
│             ▼                                          │
│  ┌─────────────────────────────────────┐             │
│  │  TTS Generation                     │             │
│  │  • Convert response to audio        │             │
│  │  • Stream audio chunks              │             │
│  └──────────┬──────────────────────────┘             │
│             │                                          │
│             ▼                                          │
│  ┌─────────────────────────────────────┐             │
│  │  Database & Analytics Logging       │             │
│  │  • Save messages                    │             │
│  │  • Log API usage (STT/LLM/TTS)      │             │
│  │  • Update session stats             │             │
│  └─────────────────────────────────────┘             │
│                                                        │
└────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Stream to Client               │
│  • {"type": "ai_response"}      │
│  • {"type": "audio_chunk"}      │
│  • {"type": "metrics"}          │
└─────────────────────────────────┘
```

### 3. Analytics Pipeline

```
┌──────────────────────────────────────┐
│      API Call Happens                │
│  (STT, LLM, TTS, RAG, Translation)   │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Analytics Service                   │
│  log_api_usage()                     │
│  • service_type                      │
│  • tokens_used                       │
│  • cost (calculated)                 │
│  • response_time_ms                  │
│  • status (success/error)            │
└──────────┬───────────────────────────┘
           │
           ├─── Explicit Flush ───┐
           │                      │
           ▼                      ▼
┌──────────────────┐    ┌─────────────────┐
│  Insert Record   │    │  Update Session │
│  api_usage_logs  │    │  • tokens_used  │
│  table           │    │  • api_calls    │
└──────────────────┘    └─────────────────┘
           │
           │  db.commit()
           ▼
┌──────────────────────────────────────┐
│  Analytics Aggregation               │
│  • By service type                   │
│  • By hospital/doctor/patient        │
│  • By time period                    │
│  • Real-time dashboards              │
└──────────────────────────────────────┘
```

---

## 🚀 Installation

### Prerequisites

- **Python 3.10+**
- **MySQL 8.0+**
- **Redis 6.0+**
- **ffmpeg** (for audio processing)

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd AvatarOpenAI
```

### Step 2: Create Virtual Environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 4: Environment Configuration

Create `.env` file:

```env
# Database
DATABASE_URL=mysql+asyncmy://user:password@localhost:3306/avatar_doctor

# AI Services
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
SARVAM_API_KEY=...
GEMINI_API_KEY=...

# Redis
REDIS_URL=redis://localhost:6379/2
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRY_SECONDS=4000
JTI_EXPIRY_SECONDS=3600

# Server
HOST=0.0.0.0
PORT=8000
DEBUG=True
ENVIRONMENT=development

# OAuth (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SECRET_KEY=...
```

### Step 5: Database Setup

```bash
# Create database
mysql -u root -p
CREATE DATABASE avatar_doctor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# Import schema
mysql -u root -p avatar_doctor < the_final.sql
```

### Step 6: Run Server

```bash
# Development
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## ⚙️ Configuration

### AI Service Configuration

```python
# OpenAI
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=300
OPENAI_TEMPERATURE=0.3

# Deepgram
DEEPGRAM_STT_MODEL=nova-3-general
DEEPGRAM_TTS_VOICE=aura-kathleen-en

# Sarvam
SARVAM_STT_MODEL=saarika:v2.5
SARVAM_TTS_SPEAKER=karun

# RAG
RAG_MAX_CHARS=4000
RAG_K_CHUNKS=5
RAG_MAX_TOKENS=300
```

### Security Configuration

```python
# CORS
CORS_ORIGINS=["http://localhost:3000", "https://yourdomain.com"]

# Trusted IPs (for /docs access)
ENFORCE_TRUSTED_IPS=False  # Set True in production
```

---

## 📡 API Endpoints

### Authentication

```
POST   /api/v1/auth/login          - Login with email/password
POST   /api/v1/auth/refresh        - Refresh access token
POST   /api/v1/auth/logout         - Logout (revoke refresh token)
```

### Consultations

```
POST   /api/v1/consultation/create - Create new consultation
POST   /api/v1/conversation/message - Send text message
POST   /api/v1/conversation/audio  - Send audio message
GET    /api/v1/conversation/audio  - Get TTS audio
```

### WebSocket

```
WS     /api/v1/ws/streaming        - Real-time voice streaming
```

### RAG

```
POST   /api/v1/rag/ingest-upload   - Upload medical knowledge
GET    /api/v1/rag/search          - Search RAG database
POST   /api/v1/rag/answer          - Get RAG-enhanced answer
```

### Analytics

```
GET    /api/v1/unified-analytics   - Get comprehensive analytics
GET    /api/v1/analytics/cost-breakdown - Cost analysis
GET    /api/v1/analytics/performance   - Performance metrics
```

### Admin

```
GET    /api/v1/admin/hospitals/:id/roles        - List hospital roles
POST   /api/v1/admin/hospitals/:id/roles        - Create role
PATCH  /api/v1/admin/hospitals/:id/roles/:roleId - Update role
DELETE /api/v1/admin/hospitals/:id/roles/:roleId - Delete role
```

---

## 📊 Analytics & Monitoring

### Cost Calculation Formulas

```python
# OpenAI GPT-4o-mini
cost = (input_tokens / 1000 * 0.03) + (output_tokens / 1000 * 0.06)

# Deepgram STT
cost = (audio_duration_sec / 60) * 0.0043

# Deepgram TTS
cost = (audio_size_bytes / 1000000) * 0.01

# Sarvam STT
cost = (audio_duration_sec / 60) * 0.002

# Sarvam TTS
cost = (audio_size_bytes / 1000000) * 0.005

# Sarvam Translation
cost = (input_length / 1000) * 0.001

# RAG Retrieval
cost = (context_length / 1000) * 0.001
```

### Metrics Tracked

- **Request Count** - Total API calls by service type
- **Latency** - Response time in milliseconds
- **Token Usage** - Input/output tokens per request
- **Cost** - Calculated cost in USD (also converted to INR)
- **Success Rate** - Percentage of successful requests
- **Session Statistics** - Tokens/calls per consultation session

---

## 🛡️ Error Handling

### Centralized Error Handling

All service layers use centralized custom exceptions:

```python
# Exception Types
- ValidationError        # Input validation failures
- AuthenticationError    # Login/token failures
- AuthorizationError     # Permission denied
- DatabaseError          # General database errors
- DataIntegrityError     # FK/unique constraint violations
- ConnectionError        # Database connection failures
- TransactionError       # Transaction state errors
- SessionError           # Session management errors
- ResourceNotFoundError  # Missing resources
- UserNotFoundError      # User lookup failures
```

### Error Response Format

```json
{
  "error": "DataIntegrityError",
  "message": "Foreign key violation during consultation creation",
  "error_code": "DATA_INTEGRITY_ERROR",
  "context": {
    "constraint_type": "foreign_key",
    "table": "consultation",
    "field": "patient_id",
    "value": 999,
    "operation": "create_consultation_flush"
  }
}
```

---

## 📝 License

[Your License Here]

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

---

## 📞 Support

For issues and questions:
- GitHub Issues: [Create an issue]
- Email: [Your email]

---

## 🙏 Acknowledgments

- OpenAI for GPT models
- Deepgram for STT/TTS services
- Sarvam AI for Indian language support
- FastAPI framework and community

---

**Built with ❤️ for better healthcare accessibility**
