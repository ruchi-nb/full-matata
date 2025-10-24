# 📝 Transcript System - Complete Guide

## Overview

The transcript system provides **role-based access control** for viewing consultation conversation histories. Each role (Patient, Doctor, Hospital Admin) has specific permissions and can only access transcripts they're authorized to see.

---

## 🔐 Access Control Matrix

| Role | Access Level | What They Can See |
|------|-------------|-------------------|
| **Patient** | Own Consultations Only | All transcripts from consultations they participated in |
| **Doctor** | Own Consultations Only | All transcripts from consultations they conducted |
| **Hospital Admin** | Hospital-wide | All transcripts from doctors working in their hospital(s) |
| **Superadmin** | Platform-wide | All transcripts across all hospitals |

---

## 📊 Database Architecture

### Data Flow
```
Consultation (patient_id, doctor_id, hospital_id)
    ↓
ConsultationSessions (session_id)
    ↓
ConsultationMessages (message_text, sender_type)
```

### Key Relationships
- **Consultation** → Links patient, doctor, and hospital
- **ConsultationSessions** → Multiple sessions per consultation
- **ConsultationMessages** → All conversation messages
- **Redis Cache** → Real-time conversation storage (fallback to DB)

---

## 🚀 API Endpoints

### Base URL: `/api/v1/transcripts`

---

### 1. **Patient Transcripts**
```http
GET /api/v1/transcripts/patient?limit=50
```

**Authorization**: Requires `patient.transcripts.view` permission

**Query Parameters**:
- `limit` (optional): Maximum number of transcripts (default: 50)

**Response**:
```json
{
  "status": "success",
  "count": 5,
  "transcripts": [
    {
      "consultation_id": 118,
      "consultation_date": "2025-10-24T11:52:44",
      "consultation_type": "online",
      "status": "completed",
      "patient": {
        "patient_id": 14,
        "patient_name": "kshitij",
        "patient_email": "patient@example.com"
      },
      "doctor": {
        "doctor_id": 17,
        "doctor_name": "Dr. cats dogs",
        "doctor_email": "doctor@example.com"
      },
      "hospital": {
        "hospital_id": 1,
        "hospital_name": "City Lmao Hospital"
      },
      "total_sessions": 1,
      "total_messages": 6,
      "messages": [
        {
          "message_id": 1,
          "session_id": 72,
          "sender_type": "patient",
          "message_text": "hello doctor",
          "timestamp": "2025-10-24T11:52:52"
        },
        {
          "message_id": 2,
          "session_id": 72,
          "sender_type": "ai_doctor",
          "message_text": "Hello! Can I have your name...",
          "timestamp": "2025-10-24T11:52:57"
        }
      ]
    }
  ]
}
```

**Example (JavaScript)**:
```javascript
const response = await fetch(
  'http://localhost:8000/api/v1/transcripts/patient?limit=20',
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  }
);
const data = await response.json();
console.log('My Transcripts:', data.transcripts);
```

---

### 2. **Doctor Transcripts**
```http
GET /api/v1/transcripts/doctor?patient_id=14&limit=50
```

**Authorization**: Requires `doctor.transcripts.view` permission

**Query Parameters**:
- `patient_id` (optional): Filter by specific patient
- `limit` (optional): Maximum number of transcripts (default: 50)

**Response**: Same structure as patient transcripts

**Example (JavaScript)**:
```javascript
// Get all transcripts
const allTranscripts = await fetch(
  'http://localhost:8000/api/v1/transcripts/doctor',
  {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }
).then(r => r.json());

// Get transcripts for specific patient
const patientTranscripts = await fetch(
  'http://localhost:8000/api/v1/transcripts/doctor?patient_id=14',
  {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }
).then(r => r.json());
```

---

### 3. **Hospital Admin Transcripts**
```http
GET /api/v1/transcripts/hospital-admin?doctor_id=17&limit=100
```

**Authorization**: Requires `hospital_admin.transcripts.view` permission

**Query Parameters**:
- `doctor_id` (optional): Filter by specific doctor
- `limit` (optional): Maximum number of transcripts (default: 100)

**Response**: Same structure as patient transcripts

**Example (JavaScript)**:
```javascript
// Get all transcripts from hospital
const allHospitalTranscripts = await fetch(
  'http://localhost:8000/api/v1/transcripts/hospital-admin?limit=100',
  {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }
).then(r => r.json());

// Get transcripts for specific doctor
const doctorTranscripts = await fetch(
  'http://localhost:8000/api/v1/transcripts/hospital-admin?doctor_id=17',
  {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }
).then(r => r.json());
```

---

### 4. **Specific Consultation Transcript**
```http
GET /api/v1/transcripts/consultation/{consultation_id}
```

**Authorization**: Requires `transcripts.view` permission

**Access Control**: 
- Verifies user has permission to view this specific transcript
- Patient: Must be their consultation
- Doctor: Must be their consultation
- Hospital Admin: Must be from their hospital
- Superadmin: Can view any

**Example (JavaScript)**:
```javascript
const transcript = await fetch(
  'http://localhost:8000/api/v1/transcripts/consultation/118',
  {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }
).then(r => r.json());

console.log('Consultation:', transcript.transcript);
```

---

### 5. **Transcript Summary**
```http
GET /api/v1/transcripts/summary
```

**Authorization**: Requires `transcripts.view` permission

**Response**:
```json
{
  "status": "success",
  "role": "patient",
  "summary": {
    "total_transcripts": 10,
    "total_messages": 85,
    "total_sessions": 12,
    "avg_messages_per_transcript": 8.5
  }
}
```

---

## 🔧 Setup Instructions

### 1. **Database Permissions**

Run the permissions seeding script:

```bash
mysql -u root -p your_database < backend/seed_transcript_permissions.sql
```

This will add:
- `patient.transcripts.view`
- `doctor.transcripts.view`
- `hospital_admin.transcripts.view`
- `transcripts.view`

And assign them to the appropriate roles.

### 2. **Verify Permissions**

```sql
-- Check if permissions exist
SELECT * FROM permission_master WHERE permission_name LIKE '%transcript%';

-- Check role assignments
SELECT 
    rm.role_name,
    pm.permission_name
FROM role_permission rp
JOIN role_master rm ON rp.role_id = rm.role_id
JOIN permission_master pm ON rp.permission_id = pm.permission_id
WHERE pm.permission_name LIKE '%transcript%';
```

---

## 🧪 Testing

### Test Patient Access
```bash
# Login as patient
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "patient@example.com", "password": "password123"}'

# Get transcripts
curl -X GET http://localhost:8000/api/v1/transcripts/patient \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Test Doctor Access
```bash
# Login as doctor
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "doctor@example.com", "password": "password123"}'

# Get transcripts
curl -X GET http://localhost:8000/api/v1/transcripts/doctor \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Test Hospital Admin Access
```bash
# Login as hospital admin
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin@hospital.com", "password": "password123"}'

# Get transcripts
curl -X GET http://localhost:8000/api/v1/transcripts/hospital-admin \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🔍 How It Works

### 1. **Session Storage**

Conversations are stored in two places:

**Redis (Real-time)**:
- Key: `session-{session_id}`
- Contains: Recent conversation messages
- TTL: Configurable (default: session duration)

**MySQL (Persistent)**:
- Table: `consultation_messages`
- Contains: All messages with timestamps
- Linked to: `consultation_sessions` → `consultation`

### 2. **Permission Verification**

```python
# For each request, the system:
1. Identifies user role from JWT token
2. Checks role-specific permissions
3. Queries database with proper filters
4. Returns only authorized transcripts
```

### 3. **Association Tracking**

The `consultation` table maintains all relationships:
```sql
CREATE TABLE consultation (
  consultation_id INT PRIMARY KEY,
  patient_id INT,           -- Links to patient
  doctor_id INT,            -- Links to doctor
  hospital_id INT,          -- Links to hospital
  specialty_id INT,
  consultation_date DATETIME,
  status VARCHAR(50)
);
```

---

## 📱 Frontend Integration

### React/Next.js Example

```javascript
// Create a transcript service
class TranscriptService {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async getMyTranscripts(role) {
    const endpoint = {
      'patient': '/api/v1/transcripts/patient',
      'doctor': '/api/v1/transcripts/doctor',
      'hospital_admin': '/api/v1/transcripts/hospital-admin'
    }[role];

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });

    if (!response.ok) throw new Error('Failed to fetch transcripts');
    return await response.json();
  }

  async getConsultationTranscript(consultationId) {
    const response = await fetch(
      `${this.baseURL}/api/v1/transcripts/consultation/${consultationId}`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      }
    );

    if (!response.ok) throw new Error('Transcript not found');
    return await response.json();
  }
}

// Usage in component
const transcriptService = new TranscriptService('http://localhost:8000');

function TranscriptList({ userRole }) {
  const [transcripts, setTranscripts] = useState([]);

  useEffect(() => {
    transcriptService.getMyTranscripts(userRole)
      .then(data => setTranscripts(data.transcripts))
      .catch(console.error);
  }, [userRole]);

  return (
    <div>
      {transcripts.map(t => (
        <div key={t.consultation_id}>
          <h3>Consultation #{t.consultation_id}</h3>
          <p>Date: {t.consultation_date}</p>
          <p>Messages: {t.total_messages}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 🛡️ Security Features

### 1. **Role-Based Access Control (RBAC)**
- Permissions checked at endpoint level
- Database queries filtered by role
- No cross-role data leakage

### 2. **Consultation-Level Verification**
- Each transcript access verifies relationships
- Patient ↔ Consultation ↔ Doctor ↔ Hospital
- Prevents unauthorized access via direct IDs

### 3. **JWT Token Validation**
- All endpoints require valid JWT
- User identity extracted from token
- Token expiration enforced

### 4. **Audit Trail**
- All transcript access logged
- User actions tracked via audit_logs table
- Compliance ready

---

## 📊 Data Retention

### Current Implementation
- **Redis**: Session-based (cleared after consultation)
- **MySQL**: Permanent storage
- **No automatic deletion**

### Recommended Policy
```python
# Example: Auto-delete after 7 years (HIPAA compliance)
DELETE FROM consultation_messages
WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 YEAR);
```

---

## 🚨 Troubleshooting

### Issue: "403 Forbidden"
**Cause**: Missing permissions
**Fix**: Run `seed_transcript_permissions.sql`

### Issue: "Empty transcripts array"
**Cause**: No consultations or incorrect role
**Fix**: Verify user has associated consultations in database

### Issue: "Transcript not found"
**Cause**: Consultation doesn't exist or no access
**Fix**: Check `consultation_id` and user permissions

---

## 📝 Next Steps

### Recommended Enhancements
1. **Export Transcripts**: PDF/CSV download functionality
2. **Search**: Full-text search across transcripts
3. **Analytics**: Transcript insights and trends
4. **Notifications**: Alert when new transcripts available
5. **Archiving**: Automatic archival of old transcripts

---

## 📚 Additional Resources

- [Database Schema Reference](./DATABASE_SCHEMA_AND_PERMISSIONS_REFERENCE.md)
- [Default Roles and Permissions](./DEFAULT_ROLES_AND_PERMISSIONS.md)
- [API Integration Guide](./NEXTJS_BACKEND_INTEGRATION_COMPLETE_GUIDE.md)

---

**Need Help?** Check the logs at `backend/logs/app.log` for detailed error messages.

