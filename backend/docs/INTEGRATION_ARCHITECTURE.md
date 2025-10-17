# FastAPI to Next.js Integration Architecture

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE LAYER                     │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Frontend (React Components)                           │
│  ├── Patient Portal Pages                                      │
│  ├── Doctor Portal Pages                                       │
│  ├── Admin Portal Pages                                        │
│  └── Authentication Pages                                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API INTEGRATION LAYER                    │
├─────────────────────────────────────────────────────────────────┤
│  API Service Modules                                            │
│  ├── api-auth.js (Authentication)                              │
│  ├── api-consultation.js (Consultation Management)            │
│  ├── api-conversation.js (Real-time Chat)                     │
│  ├── api-doctor.js (Doctor Management)                        │
│  └── api-analytics.js (Analytics)                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        COMMUNICATION LAYER                      │
├─────────────────────────────────────────────────────────────────┤
│  HTTP/HTTPS Requests                                            │
│  WebSocket Connections                                          │
│  File Uploads (Audio/Images)                                    │
│  Real-time Streaming                                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND API LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  FastAPI Backend                                                │
│  ├── /api/v1/auth/* (Authentication Routes)                    │
│  ├── /api/v1/consultation/* (Consultation Routes)              │
│  ├── /api/v1/conversation/* (Conversation Routes)              │
│  ├── /api/v1/doctors/* (Doctor Routes)                         │
│  ├── /api/v1/hospital/* (Hospital Routes)                      │
│  └── /api/v1/analytics/* (Analytics Routes)                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  MySQL Database                                                 │
│  ├── Users Table (Doctors, Patients, Admins)                   │
│  ├── Consultations Table                                        │
│  ├── Conversations Table                                        │
│  ├── Hospitals Table                                            │
│  └── Analytics Tables                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Current vs Target Architecture

### Current Architecture (HTML Templates + Static JS)
```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT SYSTEM                              │
├─────────────────────────────────────────────────────────────────┤
│  FastAPI Backend                                                │
│  ├── HTML Templates (/templates/*.html)                        │
│  ├── Static JS Files (/static/*.js)                            │
│  ├── CSS Files (/static/*.css)                                │
│  └── API Routes (/api/v1/*)                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Target Architecture (Next.js Frontend)
```
┌─────────────────────────────────────────────────────────────────┐
│                    TARGET SYSTEM                                │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Frontend (Port 3000)                                   │
│  ├── React Components                                           │
│  ├── API Integration Layer                                      │
│  ├── State Management                                           │
│  └── Real-time Communication                                   │
│                                │                                │
│                                ▼                                │
│  FastAPI Backend (Port 8000)                                   │
│  ├── API Routes Only                                            │
│  ├── WebSocket Support                                          │
│  ├── Authentication                                             │
│  └── Database Integration                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### 1. Authentication Flow
```
User Login Request
        │
        ▼
┌─────────────────┐    HTTP POST    ┌─────────────────┐
│   Next.js       │ ──────────────► │   FastAPI       │
│   Login Page    │                 │   /auth/login   │
└─────────────────┘                 └─────────────────┘
        │                                   │
        │                                   ▼
        │                          ┌─────────────────┐
        │                          │   Database      │
        │                          │   Validation    │
        │                          └─────────────────┘
        │                                   │
        │                                   ▼
        │                          ┌─────────────────┐
        │                          │   JWT Token     │
        │                          │   Generation    │
        │                          └─────────────────┘
        │                                   │
        │                                   ▼
        │                          ┌─────────────────┐
        │                          │   Response      │
        │                          │   with Token    │
        │                          └─────────────────┘
        │                                   │
        ▼                                   ▼
┌─────────────────┐    HTTP Response ┌─────────────────┐
│   Token Storage │ ◄──────────────── │   Next.js      │
│   & Redirect    │                   │   Frontend     │
└─────────────────┘                   └─────────────────┘
```

### 2. Consultation Creation Flow
```
Doctor Selection
        │
        ▼
┌─────────────────┐    API Call     ┌─────────────────┐
│   Next.js       │ ──────────────► │   FastAPI       │
│   Doctor List   │                 │   /doctors/    │
└─────────────────┘                 └─────────────────┘
        │                                   │
        │                                   ▼
        │                          ┌─────────────────┐
        │                          │   Database      │
        │                          │   Query         │
        │                          └─────────────────┘
        │                                   │
        │                                   ▼
        │                          ┌─────────────────┐
        │                          │   Doctor Data   │
        │                          │   with Hospitals│
        │                          └─────────────────┘
        │                                   │
        ▼                                   ▼
┌─────────────────┐    User Selects ┌─────────────────┐
│   Doctor Cards  │ ◄────────────── │   Doctor        │
│   Display       │                 │   Selection     │
└─────────────────┘                 └─────────────────┘
        │
        ▼
┌─────────────────┐    API Call     ┌─────────────────┐
│   Consultation  │ ──────────────► │   FastAPI       │
│   Creation      │                 │   /consultation │
└─────────────────┘                 └─────────────────┘
        │                                   │
        │                                   ▼
        │                          ┌─────────────────┐
        │                          │   Database      │
        │                          │   Insert        │
        │                          └─────────────────┘
        │                                   │
        │                                   ▼
        │                          ┌─────────────────┐
        │                          │   Consultation  │
        │                          │   ID Generated  │
        │                          └─────────────────┘
        │                                   │
        ▼                                   ▼
┌─────────────────┐    Response    ┌─────────────────┐
│   Redirect to    │ ◄───────────── │   Consultation  │
│   Conversation  │                │   Created       │
└─────────────────┘                └─────────────────┘
```

### 3. Real-time Conversation Flow
```
User Input (Text/Audio)
        │
        ▼
┌─────────────────┐    WebSocket   ┌─────────────────┐
│   Next.js       │ ──────────────► │   FastAPI       │
│   Chat Interface│                 │   WebSocket    │
└─────────────────┘                 └─────────────────┘
        │                                   │
        │                                   ▼
        │                          ┌─────────────────┐
        │                          │   AI Processing │
        │                          │   (OpenAI/Sarvam)│
        │                          └─────────────────┘
        │                                   │
        │                                   ▼
        │                          ┌─────────────────┐
        │                          │   Response      │
        │                          │   Generation    │
        │                          └─────────────────┘
        │                                   │
        │                                   ▼
        │                          ┌─────────────────┐
        │                          │   Database      │
        │                          │   Logging       │
        │                          └─────────────────┘
        │                                   │
        ▼                                   ▼
┌─────────────────┐    WebSocket   ┌─────────────────┐
│   Message        │ ◄───────────── │   AI Response   │
│   Display        │                │   Sent          │
└─────────────────┘                └─────────────────┘
```

## Integration Requirements

### Backend Requirements
```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND REQUIREMENTS                        │
├─────────────────────────────────────────────────────────────────┤
│  ✅ CORS Configuration                                          │
│     - Allow Next.js domain (localhost:3000)                     │
│     - Allow production domain                                   │
│     - Handle preflight requests                                 │
│                                                                 │
│  ✅ Authentication Middleware                                   │
│     - JWT token validation                                      │
│     - Role-based access control                                 │
│     - Token refresh mechanism                                   │
│                                                                 │
│  ✅ WebSocket Support                                           │
│     - Real-time communication                                   │
│     - Connection management                                     │
│     - Message broadcasting                                      │
│                                                                 │
│  ✅ File Upload Handling                                        │
│     - Audio file processing                                     │
│     - Image file processing                                     │
│     - File size limits                                          │
│                                                                 │
│  ✅ API Rate Limiting                                           │
│     - Request throttling                                        │
│     - User-based limits                                         │
│     - Endpoint-specific limits                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Frontend Requirements
```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND REQUIREMENTS                       │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Next.js 13+ with App Router                                │
│     - Modern React features                                    │
│     - Server-side rendering                                     │
│     - Static site generation                                   │
│                                                                 │
│  ✅ State Management                                            │
│     - React Context API                                        │
│     - Custom hooks                                             │
│     - Local storage integration                                │
│                                                                 │
│  ✅ API Integration                                             │
│     - HTTP client (Axios/Fetch)                                │
│     - WebSocket client                                         │
│     - Error handling                                            │
│                                                                 │
│  ✅ Audio Processing                                            │
│     - Microphone access                                         │
│     - Audio recording                                           │
│     - Audio playback                                           │
│                                                                 │
│  ✅ Real-time Communication                                    │
│     - WebSocket connections                                     │
│     - Message handling                                          │
│     - Connection management                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Migration Steps

### Phase 1: Project Setup
```
1. Create Next.js project
   ├── Install dependencies
   ├── Configure TypeScript (optional)
   ├── Set up environment variables
   └── Configure build settings

2. Set up project structure
   ├── Create folder hierarchy
   ├── Set up routing
   ├── Configure layouts
   └── Set up navigation
```

### Phase 2: API Integration
```
1. Create API client
   ├── Base configuration
   ├── Authentication handling
   ├── Error handling
   └── Request/response interceptors

2. Create service modules
   ├── Authentication service
   ├── Consultation service
   ├── Conversation service
   ├── Doctor service
   └── Analytics service
```

### Phase 3: Component Development
```
1. Create page components
   ├── Login page
   ├── Doctor selection page
   ├── Consultation page
   ├── Conversation page
   └── Analytics page

2. Create reusable components
   ├── Form components
   ├── Navigation components
   ├── Audio components
   └── Chat components
```

### Phase 4: Real-time Features
```
1. WebSocket integration
   ├── Connection management
   ├── Message handling
   ├── Reconnection logic
   └── Error handling

2. Audio features
   ├── Recording functionality
   ├── Playback functionality
   ├── Audio processing
   └── Microphone permissions
```

### Phase 5: Testing and Deployment
```
1. Testing
   ├── Unit tests
   ├── Integration tests
   ├── End-to-end tests
   └── Performance tests

2. Deployment
   ├── Build configuration
   ├── Environment setup
   ├── Production deployment
   └── Monitoring setup
```

## Key Integration Points

### 1. Authentication Integration
- Replace HTML login forms with React components
- Implement JWT token management
- Create protected route wrapper
- Handle token refresh automatically

### 2. Conversation Integration
- Convert static chat interface to React components
- Implement WebSocket connection management
- Handle real-time message updates
- Manage audio recording and playback

### 3. Doctor Selection Integration
- Create interactive doctor selection interface
- Implement filtering and search functionality
- Handle hospital and specialty associations
- Manage consultation creation flow

### 4. Analytics Integration
- Convert HTML analytics pages to React components
- Implement real-time data updates
- Create interactive charts and graphs
- Handle data filtering and export

## Success Metrics

### Technical Metrics
- Page load time: < 2 seconds
- API response time: < 500ms
- WebSocket connection stability: > 99%
- Error rate: < 1%

### User Experience Metrics
- Seamless authentication flow
- Intuitive navigation
- Smooth real-time communication
- Responsive design across devices

### Business Metrics
- Increased user engagement
- Higher consultation completion rates
- Improved system reliability
- Better user satisfaction scores

## Conclusion

This architecture provides a clear roadmap for migrating from HTML templates and static JS files to a modern Next.js frontend that integrates seamlessly with your FastAPI backend. The key is maintaining functionality while improving user experience, performance, and maintainability.

Follow the migration steps systematically, and you'll have a robust, scalable frontend that properly integrates with your existing FastAPI conversation and API routes.
