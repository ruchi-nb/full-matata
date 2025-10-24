# 📐 Transcript System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TRANSCRIPT SYSTEM                            │
│                     (Role-Based Access Control)                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js/React)                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐            │
│  │   Patient   │    │   Doctor    │    │ Hospital Admin   │            │
│  │   Portal    │    │   Portal    │    │     Portal       │            │
│  │  (Blue)     │    │  (Green)    │    │   (Purple)       │            │
│  └──────┬──────┘    └──────┬──────┘    └────────┬─────────┘            │
│         │                  │                     │                       │
│         └──────────────────┴─────────────────────┘                       │
│                            │                                             │
│                   ┌────────▼─────────┐                                   │
│                   │  Service Layer   │                                   │
│                   │ transcript-      │                                   │
│                   │  service.js      │                                   │
│                   └────────┬─────────┘                                   │
│                            │                                             │
└────────────────────────────┼─────────────────────────────────────────────┘
                             │
                             │ HTTPS + JWT Token
                             │
┌────────────────────────────▼─────────────────────────────────────────────┐
│                         BACKEND (FastAPI/Python)                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│                   ┌────────────────────┐                                 │
│                   │  API Router        │                                 │
│                   │  transcript_       │                                 │
│                   │  router.py         │                                 │
│                   └────────┬───────────┘                                 │
│                            │                                             │
│                   ┌────────▼───────────┐                                 │
│                   │ Auth Middleware    │                                 │
│                   │ (JWT + Permissions)│                                 │
│                   └────────┬───────────┘                                 │
│                            │                                             │
│                   ┌────────▼───────────┐                                 │
│                   │  Service Layer     │                                 │
│                   │  transcript_       │                                 │
│                   │  service.py        │                                 │
│                   └────────┬───────────┘                                 │
│                            │                                             │
│         ┌──────────────────┴──────────────────┐                          │
│         │                                     │                          │
│    ┌────▼─────┐                      ┌───────▼──────┐                   │
│    │  MySQL   │                      │    Redis     │                   │
│    │ Database │                      │    Cache     │                   │
│    └──────────┘                      └──────────────┘                   │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow

### 1. Patient Viewing Transcripts

```
┌──────────┐    1. Click "Transcripts"        ┌──────────────┐
│ Patient  │───────────────────────────────────>│ Frontend     │
│ Browser  │                                    │ Page Load    │
└──────────┘                                    └──────┬───────┘
                                                       │
                                              2. Call getPatientTranscripts()
                                                       │
                                                       ▼
                                              ┌────────────────┐
                                              │ Service Layer  │
                                              │ (JS)           │
                                              └───────┬────────┘
                                                      │
                                      3. GET /api/v1/transcripts/patient
                                      Authorization: Bearer <JWT>
                                                      │
                                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                         BACKEND                                   │
│                                                                   │
│  ┌────────────────┐   4. Verify JWT    ┌─────────────────┐      │
│  │ API Router     │─────────────────────>│ Auth Middleware │      │
│  └────────┬───────┘                     └─────────────────┘      │
│           │                                                       │
│           │ 5. Extract user_id & role                             │
│           ▼                                                       │
│  ┌─────────────────┐   6. Query DB      ┌──────────────┐        │
│  │ Service Layer   │─────────────────────>│   MySQL     │        │
│  │ (Python)        │   WHERE patient_id   │  Database   │        │
│  │                 │   = user_id          └──────────────┘        │
│  └────────┬────────┘                                              │
│           │ 7. Build transcript                                   │
│           │    (combine DB + Redis)                               │
│           ▼                                                       │
│  ┌─────────────────┐   8. Return JSON    ┌──────────────┐        │
│  │ Response        │<─────────────────────│   Redis      │        │
│  │ [transcripts]   │                     │   Cache      │        │
│  └────────┬────────┘                     └──────────────┘        │
└───────────┼───────────────────────────────────────────────────────┘
            │
            │ 9. JSON Response
            ▼
   ┌────────────────┐
   │ Frontend       │
   │ Display        │
   │ Transcripts    │
   └────────────────┘
```

---

## 🔐 Role-Based Access Control

### Permission Matrix

```
┌─────────────────────┬──────────┬──────────┬───────────────┬────────────┐
│ Action              │ Patient  │ Doctor   │ Hospital Admin│ Superadmin │
├─────────────────────┼──────────┼──────────┼───────────────┼────────────┤
│ View Own Transcripts│    ✅    │    ✅    │      ✅       │     ✅     │
│ View Patient Trans  │    ❌    │    ✅    │      ✅       │     ✅     │
│ View Doctor Trans   │    ❌    │    ❌    │      ✅       │     ✅     │
│ View Hospital-Wide  │    ❌    │    ❌    │      ✅       │     ✅     │
│ View All Hospitals  │    ❌    │    ❌    │      ❌       │     ✅     │
└─────────────────────┴──────────┴──────────┴───────────────┴────────────┘
```

### Database Query Filters

```sql
-- PATIENT QUERY
SELECT * FROM consultation
WHERE patient_id = current_user_id;

-- DOCTOR QUERY
SELECT * FROM consultation
WHERE doctor_id = current_user_id;

-- HOSPITAL ADMIN QUERY
SELECT * FROM consultation
WHERE hospital_id IN (SELECT hospital_id FROM doctor_hospitals WHERE user_id = current_user_id);

-- SUPERADMIN QUERY
SELECT * FROM consultation;  -- No filter, all access
```

---

## 💾 Database Schema (Relevant Tables)

```
┌──────────────────────────────────────────────────────────────────┐
│                          consultation                             │
├──────────────────────────────────────────────────────────────────┤
│ consultation_id (PK)                                              │
│ patient_id (FK → users.user_id)         ← PATIENT LINK          │
│ doctor_id (FK → users.user_id)          ← DOCTOR LINK           │
│ hospital_id (FK → hospital_master.hospital_id) ← HOSPITAL LINK  │
│ specialty_id                                                      │
│ consultation_date                                                 │
│ status                                                            │
└────────────┬─────────────────────────────────────────────────────┘
             │
             │ 1:N
             ▼
┌──────────────────────────────────────────────────────────────────┐
│                     consultation_sessions                         │
├──────────────────────────────────────────────────────────────────┤
│ session_id (PK)                                                   │
│ consultation_id (FK → consultation.consultation_id)               │
│ session_type (text/speech)                                        │
│ total_tokens_used                                                 │
└────────────┬─────────────────────────────────────────────────────┘
             │
             │ 1:N
             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    consultation_messages                          │
├──────────────────────────────────────────────────────────────────┤
│ message_id (PK)                                                   │
│ session_id (FK → consultation_sessions.session_id)                │
│ sender_type (patient/ai_doctor/system)                            │
│ message_text (LONGTEXT)                                           │
│ timestamp                                                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔄 API Request Flow

### Complete Request-Response Cycle

```
STEP 1: User Action
├─ Patient clicks "View Transcripts"
└─ Browser loads /patientportal/transcripts

STEP 2: Frontend Service Call
├─ getPatientTranscripts(50)
├─ Read JWT token from localStorage
└─ Construct API request

STEP 3: HTTP Request
├─ Method: GET
├─ URL: /api/v1/transcripts/patient?limit=50
├─ Headers: Authorization: Bearer <JWT>
└─ Send to Backend

STEP 4: Backend - Router Layer
├─ Receive request
├─ Route to transcript_router.py
└─ Call get_patient_transcripts()

STEP 5: Backend - Auth Middleware
├─ Decode JWT token
├─ Extract user_id and role
├─ Check permission: patient.transcripts.view
└─ Pass to service layer

STEP 6: Backend - Service Layer
├─ Call transcript_service.get_patient_transcripts()
├─ Query: SELECT * FROM consultation WHERE patient_id = user_id
├─ Join with consultation_sessions
├─ Join with consultation_messages
├─ Check Redis for additional messages
└─ Build transcript objects

STEP 7: Backend - Response
├─ Format as JSON
├─ Include: consultation_id, date, doctor, patient, messages
└─ Return HTTP 200 with data

STEP 8: Frontend - Process Response
├─ Receive JSON data
├─ Parse transcripts array
├─ Update state: setTranscripts(data.transcripts)
└─ Trigger re-render

STEP 9: Frontend - Display
├─ TranscriptList component renders grid
├─ Each transcript shown as a card
├─ User can click "View" to open modal
└─ TranscriptViewer shows full details
```

---

## 🎨 Component Hierarchy

```
┌────────────────────────────────────────────────────────────┐
│                      Page Component                         │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Header (Title, Stats, Search, Filters)              │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Summary Statistics (Cards)                           │ │
│  │  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐         │ │
│  │  │ Total │  │ Msgs  │  │ Sess  │  │ Avg   │         │ │
│  │  └───────┘  └───────┘  └───────┘  └───────┘         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  TranscriptList Component                             │ │
│  │                                                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │ │
│  │  │ Consult  │  │ Consult  │  │ Consult  │           │ │
│  │  │ Card #1  │  │ Card #2  │  │ Card #3  │           │ │
│  │  │          │  │          │  │          │           │ │
│  │  │ [View]   │  │ [View]   │  │ [View]   │           │ │
│  │  └──────────┘  └──────────┘  └──────────┘           │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  TranscriptViewer Modal (when opened)                 │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │  Header: Consultation Info                       │  │ │
│  │  │  - ID, Date, Patient, Doctor                     │  │ │
│  │  ├─────────────────────────────────────────────────┤  │ │
│  │  │  Messages:                                       │  │ │
│  │  │  ┌─────────────────────────────────────────┐    │  │ │
│  │  │  │ 👤 Patient: hello doctor                │    │  │ │
│  │  │  └─────────────────────────────────────────┘    │  │ │
│  │  │  ┌─────────────────────────────────────────┐    │  │ │
│  │  │  │ 🩺 AI Doctor: Hello! Can I help...      │    │  │ │
│  │  │  └─────────────────────────────────────────┘    │  │ │
│  │  ├─────────────────────────────────────────────────┤  │ │
│  │  │  [Download] [Close]                              │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 Performance Optimizations

### Backend
- ✅ Database query optimization with `joinedload()`
- ✅ Redis caching for recent conversations
- ✅ Single query with joins (no N+1 problems)
- ✅ Indexed queries on consultation_id, patient_id, doctor_id
- ✅ Limit results to prevent massive payloads

### Frontend
- ✅ Client-side search/filter (no repeated API calls)
- ✅ Lazy loading of transcript viewer modal
- ✅ Responsive images and icons
- ✅ Debounced search input (if needed)
- ✅ Skeleton loading states

---

## 📈 Scalability Considerations

### Current Implementation
- Handles 100-200 transcripts per request efficiently
- Client-side filtering for quick UX
- Redis provides fast message retrieval

### For Scale (Future)
- Add server-side pagination
- Implement infinite scroll
- Move search to backend with full-text indexing
- Add caching layers (CDN for static assets)
- Database read replicas for heavy traffic

---

## 🎯 Key Design Decisions

### Why This Architecture?

1. **Separation of Concerns**
   - Service layer handles business logic
   - Router layer handles HTTP
   - Components handle UI

2. **Reusability**
   - Same components used across all portals
   - Service functions shared
   - Backend services modular

3. **Security**
   - Permission checks at multiple levels
   - Database queries filtered by role
   - No data leakage between roles

4. **Maintainability**
   - Clear file structure
   - Comprehensive documentation
   - Type hints and comments

---

**This architecture ensures a secure, scalable, and maintainable transcript system!** 🚀

