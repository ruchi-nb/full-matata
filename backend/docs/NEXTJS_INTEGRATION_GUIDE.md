# Next.js Frontend Integration Guide for FastAPI Backend

## Overview
This guide provides step-by-step instructions for replacing HTML templates and static JS files with a Next.js frontend that connects to your FastAPI backend conversation and API routes.

## Current System Analysis

### Backend Routes to Integrate
- **Conversation Routes**: `/api/v1/conversation/*`
- **Consultation Routes**: `/api/v1/consultation/*`
- **Authentication Routes**: `/api/v1/auth/*`
- **Doctor Routes**: `/api/v1/doctors/*`
- **Hospital Routes**: `/api/v1/hospital/*`
- **Analytics Routes**: `/api/v1/analytics/*`

### Current Frontend Assets to Replace
- HTML templates in `/backend/templates/`
- Static JS files in `/backend/static/`
- CSS files for styling

## Phase 1: Project Setup and Architecture

### Step 1.1: Next.js Project Structure
```
frontend/
├── src/
│   ├── app/                    # App Router (Next.js 13+)
│   │   ├── layout.js          # Root layout
│   │   ├── page.js            # Home page
│   │   ├── login/             # Authentication pages
│   │   ├── patientportal/     # Patient portal pages
│   │   ├── doctorportal/      # Doctor portal pages
│   │   └── admin/             # Admin pages
│   ├── components/            # Reusable components
│   │   ├── common/            # Shared components
│   │   ├── PatientPortal/     # Patient-specific components
│   │   ├── DoctorPortal/      # Doctor-specific components
│   │   └── Admin/             # Admin-specific components
│   ├── data/                  # API integration layer
│   │   ├── api.js             # Base API client
│   │   ├── api-auth.js        # Authentication API
│   │   ├── api-consultation.js # Consultation API
│   │   ├── api-conversation.js # Conversation API
│   │   └── api-doctor.js       # Doctor API
│   ├── hooks/                 # Custom React hooks
│   ├── services/              # Business logic services
│   ├── utils/                 # Utility functions
│   └── styles/                # Global styles
├── public/                    # Static assets
└── package.json
```

### Step 1.2: Environment Configuration
Create environment files for different stages:
- `.env.local` - Local development
- `.env.development` - Development server
- `.env.production` - Production deployment

### Step 1.3: Dependencies Installation
Install required packages for API integration, state management, and UI components.

## Phase 2: API Integration Layer

### Step 2.1: Base API Client Setup
Create a centralized API client that handles:
- Base URL configuration
- Authentication token management
- Request/response interceptors
- Error handling
- Token refresh logic

### Step 2.2: Authentication Integration
Replace HTML login forms with Next.js components:
- Login page component
- Token storage and management
- Protected route wrapper
- Authentication context provider
- Logout functionality

### Step 2.3: API Service Modules
Create separate API service modules for each backend route group:
- Authentication service
- Consultation service
- Conversation service
- Doctor service
- Hospital service
- Analytics service

## Phase 3: Component Migration

### Step 3.1: Template to Component Mapping
Map each HTML template to Next.js components:

**Current Templates → Next.js Components**
- `login.html` → `src/app/login/page.js`
- `conversation.html` → `src/app/patientportal/conversation/page.js`
- `consultation_form.html` → `src/app/patientportal/consultation/page.js`
- `analytics_simple.html` → `src/app/admin/analytics/page.js`
- `thank_you.html` → `src/app/patientportal/thank-you/page.js`

### Step 3.2: Static JS to React Hooks
Convert static JavaScript functionality to React hooks:
- Form handling hooks
- WebSocket connection hooks
- Audio recording hooks
- Real-time conversation hooks
- State management hooks

### Step 3.3: CSS Integration
Migrate CSS styles to:
- Global styles in `src/styles/globals.css`
- Component-specific styles
- CSS modules or styled-components
- Responsive design implementation

## Phase 4: Real-time Communication Setup

### Step 4.1: WebSocket Integration
Replace static WebSocket connections with React hooks:
- Connection management
- Message handling
- Reconnection logic
- Error handling
- Cleanup on component unmount

### Step 4.2: Audio Integration
Convert audio recording/playback to React components:
- Audio recording component
- Audio playback component
- Audio processing utilities
- Microphone permissions handling

### Step 4.3: Streaming Integration
Implement streaming for:
- Real-time conversation
- Audio streaming
- Text streaming
- File uploads

## Phase 5: State Management

### Step 5.1: Context Providers
Create React contexts for:
- User authentication state
- Conversation state
- Doctor selection state
- Language preferences
- Hospital context

### Step 5.2: Custom Hooks
Develop custom hooks for:
- API calls
- Form validation
- Real-time updates
- Audio handling
- WebSocket management

### Step 5.3: State Persistence
Implement state persistence for:
- User preferences
- Conversation history
- Selected doctors
- Language settings

## Phase 6: Routing and Navigation

### Step 6.1: App Router Setup
Configure Next.js App Router for:
- Dynamic routing
- Route protection
- Nested layouts
- Route groups

### Step 6.2: Navigation Components
Create navigation components:
- Header navigation
- Sidebar navigation
- Breadcrumb navigation
- Mobile navigation

### Step 6.3: Route Protection
Implement route protection:
- Authentication guards
- Role-based access
- Redirect logic
- Error boundaries

## Phase 7: Data Flow Integration

### Step 7.1: API Route Mapping
Map backend routes to frontend API calls:

**Backend Route → Frontend API Call**
- `POST /api/v1/consultation/create` → `consultationApi.createConsultation()`
- `POST /api/v1/conversation/text` → `conversationApi.sendTextMessage()`
- `POST /api/v1/conversation/speech` → `conversationApi.sendAudioMessage()`
- `GET /api/v1/doctors/available-doctors` → `doctorApi.getAvailableDoctors()`

### Step 7.2: Data Transformation
Implement data transformation between backend and frontend:
- Request payload formatting
- Response data normalization
- Error message handling
- Type safety implementation

### Step 7.3: Caching Strategy
Implement caching for:
- Doctor listings
- Hospital information
- User preferences
- API responses

## Phase 8: User Interface Migration

### Step 8.1: Form Components
Convert HTML forms to React components:
- Input components
- Select components
- Checkbox components
- Radio button components
- Form validation

### Step 8.2: Interactive Components
Create interactive components:
- Doctor selection cards
- Conversation interface
- Audio controls
- Language selector
- Consultation setup

### Step 8.3: Layout Components
Develop layout components:
- Page layouts
- Modal components
- Loading states
- Error states
- Success states

## Phase 9: Testing and Quality Assurance

### Step 9.1: Component Testing
Set up testing for:
- Unit tests for components
- Integration tests for API calls
- End-to-end tests for user flows
- Accessibility testing

### Step 9.2: API Testing
Implement API testing:
- Mock API responses
- Error scenario testing
- Network failure handling
- Authentication testing

### Step 9.3: Performance Testing
Test performance for:
- Page load times
- API response times
- Real-time communication
- Audio processing

## Phase 10: Deployment and Production

### Step 10.1: Build Configuration
Configure build settings:
- Environment variables
- API endpoint configuration
- Asset optimization
- Bundle splitting

### Step 10.2: Deployment Strategy
Plan deployment:
- Static site generation
- Server-side rendering
- API route handling
- CDN configuration

### Step 10.3: Monitoring and Analytics
Implement monitoring:
- Error tracking
- Performance monitoring
- User analytics
- API usage tracking

## Integration Requirements Checklist

### Backend Requirements
- [ ] CORS configuration for Next.js frontend
- [ ] API rate limiting
- [ ] Authentication middleware
- [ ] WebSocket support
- [ ] File upload handling
- [ ] Error response standardization

### Frontend Requirements
- [ ] Next.js 13+ with App Router
- [ ] React 18+ with hooks
- [ ] TypeScript support (optional but recommended)
- [ ] State management library (Context API or Redux)
- [ ] HTTP client library (Axios or Fetch)
- [ ] WebSocket client library
- [ ] Audio processing library
- [ ] UI component library (optional)

### Infrastructure Requirements
- [ ] Node.js runtime
- [ ] Package manager (npm/yarn/pnpm)
- [ ] Build tools configuration
- [ ] Environment variable management
- [ ] SSL certificate for HTTPS
- [ ] Domain configuration

## Data Flow Diagrams

### Authentication Flow
```
User Login → Frontend Form → API Call → Backend Auth → JWT Token → Frontend Storage → Protected Routes
```

### Consultation Creation Flow
```
Doctor Selection → Hospital Detection → Specialty Mapping → Consultation Creation → Conversation Start
```

### Real-time Conversation Flow
```
User Input → Frontend Processing → API Call → Backend Processing → AI Response → Frontend Display
```

### Audio Processing Flow
```
Audio Recording → Frontend Processing → API Upload → Backend STT → Text Processing → AI Response → TTS → Audio Playback
```

## Migration Timeline

### Week 1: Setup and Planning
- Project structure setup
- Environment configuration
- Dependencies installation
- API client setup

### Week 2: Core Components
- Authentication components
- Basic page components
- Navigation setup
- API integration

### Week 3: Feature Implementation
- Conversation interface
- Audio handling
- Real-time communication
- Form components

### Week 4: Testing and Optimization
- Component testing
- API testing
- Performance optimization
- Bug fixes

### Week 5: Deployment
- Build configuration
- Deployment setup
- Monitoring implementation
- Production testing

## Success Metrics

### Technical Metrics
- Page load time < 2 seconds
- API response time < 500ms
- WebSocket connection stability > 99%
- Error rate < 1%

### User Experience Metrics
- Seamless authentication flow
- Intuitive doctor selection
- Smooth conversation experience
- Responsive design across devices

### Business Metrics
- User engagement increase
- Consultation completion rate
- System reliability
- User satisfaction scores

## Troubleshooting Common Issues

### CORS Issues
- Configure backend CORS for Next.js domain
- Handle preflight requests
- Set proper headers

### Authentication Issues
- Token storage and refresh
- Route protection
- Session management

### WebSocket Issues
- Connection stability
- Reconnection logic
- Message handling

### Audio Issues
- Browser compatibility
- Microphone permissions
- Audio format support

## Conclusion

This guide provides a comprehensive approach to migrating from HTML templates and static JS files to a modern Next.js frontend that integrates seamlessly with your FastAPI backend. The key is to maintain the same functionality while improving user experience, performance, and maintainability.

Follow this guide step by step, and you'll have a robust, scalable frontend that properly integrates with your existing FastAPI backend conversation and API routes.
