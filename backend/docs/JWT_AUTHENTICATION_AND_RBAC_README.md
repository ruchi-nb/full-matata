# JWT Authentication & Role-Based Access Control (RBAC) System

## Overview

This document explains the JWT authentication and Role-Based Access Control (RBAC) system implemented in the AvatarOpenAI medical consultation platform. The system ensures secure access to different API endpoints based on user roles and permissions.

## Authentication Flow

### 1. Login Process
```
User → POST /auth/login → JWT Token → Store in localStorage → Use for API calls
```

### 2. Token Structure
```json
{
  "user": {
    "user_id": 13,
    "username": "admin",
    "email": "admin@hospital.com",
    "global_role": {
      "role_id": 5,
      "role_name": "admin"
    }
  },
  "exp": 1760595720,
  "iat": 1760591720,
  "jti": "19c2c214-1581-439a-9242-bcdb8f43ea7e",
  "refresh": false
}
```

## Role-Based Access Control (RBAC)

### System Architecture

The RBAC system consists of three main components:

1. **Roles** - Define user types (admin, doctor, patient, etc.)
2. **Permissions** - Define specific actions users can perform
3. **Role-Permission Mappings** - Link roles to their allowed permissions

### Database Schema

#### Tables:
- `role_master` - Stores role definitions
- `permission_master` - Stores permission definitions  
- `role_permission` - Maps roles to permissions
- `users` - User accounts with assigned roles

## Permissions Added for JWT Authentication

### New Permissions Created (IDs: 41-50)

The following **10 new permissions** were added specifically for JWT authentication and API security:

| Permission ID | Permission Name | Description | Purpose |
|---------------|-----------------|-------------|---------|
| 41 | `consultation.create` | Permission for consultation.create | Allows creating new medical consultations |
| 42 | `conversation.text` | Permission for conversation.text | Allows text-based conversations with AI doctor |
| 43 | `conversation.speech` | Permission for conversation.speech | Allows speech-to-text conversation processing |
| 44 | `conversation.end` | Permission for conversation.end | Allows ending consultation sessions |
| 45 | `tts.stream` | Permission for tts.stream | Allows text-to-speech audio streaming |
| 46 | `rag.ingest` | Permission for rag.ingest | Allows RAG (Retrieval-Augmented Generation) data ingestion |
| 47 | `rag.answer` | Permission for rag.answer | Allows RAG-based question answering |
| 48 | `analytics.view` | Permission for analytics.view | Allows viewing analytics data |
| 49 | `analytics.cost` | Permission for analytics.cost | Allows viewing cost analytics |
| 50 | `analytics.log` | Permission for analytics.log | Allows logging analytics events |

### Why These Permissions Were Added

#### 1. **Core Consultation Permissions** (41-44)
- **Purpose**: Secure the main consultation workflow
- **Reason**: These endpoints handle sensitive medical data and patient interactions
- **Security**: Prevents unauthorized users from creating consultations or accessing conversation data

#### 2. **Audio/Media Permissions** (45)
- **Purpose**: Control access to TTS streaming services
- **Reason**: Audio processing can be resource-intensive and should be controlled
- **Security**: Prevents abuse of audio generation services

#### 3. **AI/RAG Permissions** (46-47)
- **Purpose**: Secure AI-powered medical assistance features
- **Reason**: RAG system provides medical knowledge and should be access-controlled
- **Security**: Ensures only authorized users can access medical AI features

#### 4. **Analytics Permissions** (48-50)
- **Purpose**: Control access to system analytics and logging
- **Reason**: Analytics contain sensitive usage patterns and cost information
- **Security**: Prevents unauthorized access to business intelligence data

## API Endpoint Security

### Secured Endpoints

The following critical endpoints now require JWT authentication:

#### Consultation Management
- `POST /api/v1/consultation/create` - Requires `consultation.create`
- `POST /api/v1/conversation/end-session` - Requires `conversation.end`

#### Conversation APIs
- `POST /api/v1/conversation/text` - Requires `conversation.text`
- `POST /api/v1/conversation/speech` - Requires `conversation.speech`

#### Audio Processing
- `POST /api/v1/tts/stream` - Requires `tts.stream`

#### Analytics
- `POST /api/v1/analytics/event` - Requires `analytics.log`
- `GET /api/v1/analytics/cost-breakdown` - Requires `analytics.cost`

### Public Endpoints (No Authentication Required)

These endpoints remain accessible without authentication:

#### Session Management
- `POST /api/v1/conversation/cancel`
- `POST /api/v1/conversation/clear-session`
- `POST /api/v1/conversation/clear-all-sessions`
- `GET /api/v1/conversation/session-info`
- `POST /api/v1/conversation/cleanup-sessions`
- `GET /api/v1/conversation/session-conversation/{session_id}`
- `GET /api/v1/conversation/transcript/{session_id}`
- `GET /api/v1/conversation/transcript/download/{session_id}`

#### RAG Search
- `POST /api/v1/rag/search`

## Admin Role Configuration

### Admin User Setup

The admin user (`admin@hospital.com`) has been configured with:

- **Role**: `admin` (ID: 5)
- **Permissions**: All 10 new JWT authentication permissions (IDs: 41-50)
- **Access Level**: Full system access for testing and administration

### Permission Assignment

#### Step 1: Create the Permissions

```sql
-- Add all 10 new permissions to permission_master table
INSERT INTO permission_master (permission_name, description) VALUES
('consultation.create', 'Permission for consultation.create'),
('conversation.text', 'Permission for conversation.text'),
('conversation.speech', 'Permission for conversation.speech'),
('conversation.end', 'Permission for conversation.end'),
('tts.stream', 'Permission for tts.stream'),
('rag.ingest', 'Permission for rag.ingest'),
('rag.answer', 'Permission for rag.answer'),
('analytics.view', 'Permission for analytics.view'),
('analytics.cost', 'Permission for analytics.cost'),
('analytics.log', 'Permission for analytics.log');
```

#### Step 2: Assign Permissions to Admin Role

```sql
-- Admin role gets all new permissions (assuming admin role_id = 5)
INSERT INTO role_permission (role_id, permission_id) VALUES
(5, 41), -- consultation.create
(5, 42), -- conversation.text
(5, 43), -- conversation.speech
(5, 44), -- conversation.end
(5, 45), -- tts.stream
(5, 46), -- rag.ingest
(5, 47), -- rag.answer
(5, 48), -- analytics.view
(5, 49), -- analytics.cost
(5, 50); -- analytics.log
```

#### Step 3: Verify Permissions (Optional)

```sql
-- Check all permissions for admin role
SELECT 
    pm.permission_id,
    pm.permission_name,
    pm.description
FROM permission_master pm
JOIN role_permission rp ON pm.permission_id = rp.permission_id
JOIN role_master rm ON rp.role_id = rm.role_id
WHERE rm.role_name = 'admin'
ORDER BY pm.permission_id;
```

#### Step 4: Assign Permissions to Other Roles (Optional)

```sql
-- Example: Assign basic permissions to doctor role (assuming doctor role_id = 2)
INSERT INTO role_permission (role_id, permission_id) VALUES
(2, 41), -- consultation.create
(2, 42), -- conversation.text
(2, 43), -- conversation.speech
(2, 44), -- conversation.end
(2, 45), -- tts.stream
(2, 46), -- rag.ingest
(2, 47), -- rag.answer
(2, 48); -- analytics.view (limited analytics access)

-- Example: Assign basic permissions to patient role (assuming patient role_id = 1)
INSERT INTO role_permission (role_id, permission_id) VALUES
(1, 41), -- consultation.create
(1, 42), -- conversation.text
(1, 43), -- conversation.speech
(1, 44), -- conversation.end
(1, 45); -- tts.stream
```

#### Step 5: Check Role Permissions

```sql
-- Check permissions for any role
SELECT 
    rm.role_name,
    pm.permission_name,
    pm.description
FROM role_master rm
JOIN role_permission rp ON rm.role_id = rp.role_id
JOIN permission_master pm ON rp.permission_id = pm.permission_id
WHERE rm.role_name IN ('admin', 'doctor', 'patient')
ORDER BY rm.role_name, pm.permission_id;
```

## Frontend Integration

### JWT Token Handling

#### 1. Login Flow
```javascript
// Store token after successful login
localStorage.setItem('access_token', result.access_token);
```

#### 2. API Calls
```javascript
// Include token in all secured API calls
const token = localStorage.getItem('access_token');
const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};
```

#### 3. Authentication Check
```javascript
// Check authentication before form submission
const token = localStorage.getItem('access_token');
if (!token) {
    window.location.href = '/login';
    return;
}
```

### Form Submission Protection

Added duplicate submission prevention:

```javascript
let isSubmitting = false;
if (isSubmitting) return;
isSubmitting = true;

// Disable submit button
const submitBtn = document.querySelector('button[type="submit"]');
submitBtn.disabled = true;
submitBtn.textContent = 'Creating...';
```

## Security Benefits

### 1. **Data Protection**
- Medical consultation data is now protected by authentication
- Only authorized users can access patient information
- Prevents unauthorized AI model access

### 2. **Resource Control**
- Prevents abuse of expensive AI/audio services
- Controls access to analytics and cost data
- Limits consultation creation to authenticated users

### 3. **Audit Trail**
- All secured API calls are logged with user information
- Analytics events are tied to authenticated users
- Better tracking of system usage patterns

### 4. **Scalability**
- Role-based system allows easy permission management
- New roles can be added without code changes
- Granular permission control for different user types

## Performance Optimizations

### Redis Caching
- **Cache TTL**: Reduced from 120s to 60s for faster permission checks
- **Timeout**: Increased from 1.5s to 5.0s to prevent connection failures
- **Error Handling**: Graceful fallback when Redis is unavailable

### Request Optimization
- **Duplicate Prevention**: Form submission protection prevents multiple API calls
- **Token Validation**: Efficient JWT validation with caching
- **Permission Caching**: Redis-based permission caching for faster access

## Testing

### Admin Credentials
```
Email: admin@hospital.com
Password: admin123
```

### Test Endpoints
```bash
# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospital.com","password":"admin123"}'

# Create Consultation (requires JWT)
curl -X POST http://localhost:8000/api/v1/consultation/create \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"patient_id":"12","doctor_id":"11","specialty_id":"1","consultation_type":"hospital","audio_provider":"deepgram","language":"multi"}'
```

## Future Enhancements

### 1. **Role Expansion**
- Add `doctor` role with limited permissions
- Add `patient` role for self-service features
- Add `hospital_admin` role for hospital-specific management

### 2. **Permission Granularity**
- Add time-based permissions (e.g., consultation hours)
- Add location-based permissions (hospital-specific access)
- Add data-level permissions (own data vs. all data)

### 3. **Advanced Security**
- Implement refresh token rotation
- Add IP-based access restrictions
- Implement session management with Redis

## Troubleshooting

### Common Issues

#### 1. **403 Forbidden Errors**
- **Cause**: Missing or invalid JWT token
- **Solution**: Ensure user is logged in and token is included in Authorization header

#### 2. **Redis Connection Timeouts**
- **Cause**: Redis server not running or network issues
- **Solution**: Check Redis status with `redis-cli ping`

#### 3. **Permission Denied**
- **Cause**: User role doesn't have required permission
- **Solution**: Check user role and assigned permissions in database

### Debug Commands

```bash
# Check Redis connection
redis-cli ping

# Test login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospital.com","password":"admin123"}'

# Check server logs for permission errors
tail -f logs/app.log
```

## Conclusion

The JWT authentication and RBAC system provides a robust, scalable security framework for the medical consultation platform. By implementing granular permissions and role-based access control, the system ensures that sensitive medical data and AI services are properly protected while maintaining ease of use for authorized users.

The 10 new permissions added cover all critical API endpoints, providing comprehensive security coverage for the consultation workflow, AI interactions, and analytics features.
