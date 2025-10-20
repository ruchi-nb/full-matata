# Complete Database Tables Reference - All 25 Tables

## 📊 Overview

Your database contains **25 tables** that power a comprehensive Multi-Tenant RBAC Healthcare Platform with AI-powered consultation features.

**Table Categories:**
- 🏢 **Multi-Tenancy & Organization**: 1 table
- 👤 **User Management**: 3 tables  
- 🔐 **RBAC (Role-Based Access Control)**: 9 tables
- 🏥 **Medical Specialties**: 2 tables
- 💬 **Consultation System**: 5 tables
- 🤖 **AI Avatar Features**: 1 table
- 📁 **File Management**: 1 table
- 🔔 **Notifications**: 1 table
- 📊 **Analytics & Monitoring**: 1 table
- 📝 **Audit & Compliance**: 1 table

---

## 🏢 Multi-Tenancy & Organization Tables

### 1. **hospital_master** 
**Category:** Core Multi-Tenancy

**Purpose:** 
- Central repository for all hospital/clinic organizations (tenants)
- Each hospital is an independent tenant with isolated data
- Foundation for multi-tenant architecture

**Key Fields:**
- `hospital_id` (PK) - Unique hospital identifier
- `hospital_name` (UNIQUE) - Hospital name
- `hospital_email` - Contact email
- `admin_contact` - Primary contact phone
- `address` - Physical address

**Usage:**
- Created by **Superadmin** during hospital onboarding
- Each hospital gets default roles (hospital_admin, doctor, patient, nurse)
- All hospital-specific data (users, roles, consultations) links back to this

**Relationships:**
- One-to-Many with `hospital_role` (each hospital has multiple roles)
- Many-to-Many with `users` via `hospital_user_roles`
- One-to-Many with `consultation` (hospital-based consultations)
- One-to-Many with `api_usage_logs` (track API usage per hospital)

**Example Use Case:**
```sql
-- Get hospital profile
SELECT * FROM hospital_master WHERE hospital_id = 1;

-- Get all hospitals (superadmin view)
SELECT hospital_id, hospital_name, hospital_email FROM hospital_master;
```

---

## 👤 User Management Tables

### 2. **users**
**Category:** Core User Management

**Purpose:**
- Primary user table for ALL system users (superadmins, doctors, patients, nurses, etc.)
- Stores authentication credentials and global role assignment
- Central hub for user identity

**Key Fields:**
- `user_id` (PK) - Unique user identifier
- `username` (UNIQUE) - Login username
- `email` (UNIQUE) - Email address
- `password_hash` - Bcrypt hashed password
- `global_role_id` (FK) - Link to global role (superadmin, doctor, patient)

**Usage:**
- Created during registration or onboarding
- Can belong to multiple hospitals (via `hospital_user_roles`)
- Doctors can have multiple specialties (via `doctor_specialties`)
- Patients can register at multiple hospitals (via `patient_hospitals`)

**Relationships:**
- Many-to-One with `role_master` (global role)
- One-to-One with `user_details` (extended profile)
- One-to-One with `user_settings` (preferences)
- Many-to-Many with `hospital_master` via `hospital_user_roles`

**Example Use Case:**
```sql
-- Get user with global role
SELECT u.*, r.role_name 
FROM users u 
LEFT JOIN role_master r ON u.global_role_id = r.role_id 
WHERE u.user_id = 123;
```

---

### 3. **user_details**
**Category:** User Profile

**Purpose:**
- Extended user profile information
- Stores personal details separate from authentication data
- HIPAA-compliant personal health information storage

**Key Fields:**
- `user_id` (PK, FK) - Links to users table (1:1 relationship)
- `first_name` - User's first name
- `last_name` - User's last name
- `dob` - Date of birth
- `gender` - Gender
- `phone` - Phone number (validated for India: +91XXXXXXXXXX)
- `address` - Full address

**Usage:**
- Created when user completes profile
- Updated via profile edit endpoints
- Used for display names, patient records, doctor profiles

**Example Use Case:**
```sql
-- Get complete user profile
SELECT u.username, u.email, ud.first_name, ud.last_name, ud.phone
FROM users u
LEFT JOIN user_details ud ON u.user_id = ud.user_id
WHERE u.user_id = 123;
```

---

### 4. **user_settings**
**Category:** User Preferences

**Purpose:**
- Store user-specific settings and preferences
- Notification preferences
- Language/localization settings

**Key Fields:**
- `user_id` (PK, FK) - Links to users table (1:1 relationship)
- `notification_email` - Email notifications enabled (1/0)
- `notification_sms` - SMS notifications enabled (1/0)
- `language_preference` - Preferred language code (default: 'en')

**Usage:**
- Created with default values on user registration
- Updated via settings page
- Used to control notification delivery

**Example Use Case:**
```sql
-- Get user notification preferences
SELECT * FROM user_settings WHERE user_id = 123;
```

---

## 🔐 RBAC (Role-Based Access Control) Tables

### 5. **role_master**
**Category:** Global Roles

**Purpose:**
- Define platform-wide (global) roles
- Hierarchical role structure
- Controls what roles can manage other roles

**Key Fields:**
- `role_id` (PK) - Unique role identifier
- `role_name` (UNIQUE) - Role name (e.g., 'superadmin', 'doctor', 'patient')
- `role_scope` - Always 'platform' for global roles
- `parent_role_id` (FK) - Hierarchical parent role
- `can_manage_roles` (JSON) - Which roles this role can manage

**Default Global Roles:**
1. **superadmin** (role_id: 1) - Platform administrator
2. **doctor** (role_id: 2) - Medical doctors
3. **patient** (role_id: 3) - Patients

**Usage:**
- Assigned to users via `users.global_role_id`
- Determines platform-wide permissions
- Used for cross-hospital access control

**Example Use Case:**
```sql
-- Get all global roles
SELECT * FROM role_master WHERE role_scope = 'platform';

-- Get users by role
SELECT u.* FROM users u 
JOIN role_master r ON u.global_role_id = r.role_id 
WHERE r.role_name = 'doctor';
```

---

### 6. **hospital_role**
**Category:** Tenant-Specific Roles

**Purpose:**
- Define roles specific to each hospital (tenant-level)
- Each hospital can have custom roles
- Hierarchical structure within hospital

**Key Fields:**
- `hospital_role_id` (PK) - Unique role identifier
- `hospital_id` (FK) - Which hospital this role belongs to
- `role_name` - Role name (e.g., 'hospital_admin', 'nurse', 'receptionist')
- `parent_hospital_role_id` (FK) - Hierarchical parent
- `is_active` - Role active status

**Unique Constraint:** `(hospital_id, role_name)` - Role names must be unique per hospital

**Default Hospital Roles:**
- **hospital_admin** - Hospital administrator
- **doctor** - Hospital doctor
- **nurse** - Nursing staff
- **patient** - Hospital patient

**Usage:**
- Created automatically during hospital onboarding
- Can be customized by hospital_admin
- Assigned to users via `hospital_user_roles`

**Example Use Case:**
```sql
-- Get all roles for a hospital
SELECT * FROM hospital_role WHERE hospital_id = 1 AND is_active = 1;

-- Create custom role
INSERT INTO hospital_role (hospital_id, role_name, description) 
VALUES (1, 'lab_technician', 'Laboratory technician role');
```

---

### 7. **permission_master**
**Category:** Permission Definitions

**Purpose:**
- Central repository of ALL possible permissions in the system
- Fine-grained access control
- Reusable across global and hospital roles

**Key Fields:**
- `permission_id` (PK) - Unique permission identifier
- `permission_name` (UNIQUE) - Permission name (e.g., 'hospital.profile.view')
- `description` - Human-readable description

**Naming Convention:** `{resource}.{action}` or `{resource}.{sub_resource}.{action}`

**Permission Examples:**
- `hospital.profile.view` - View hospital profile
- `hospital.doctor.create` - Add doctor to hospital
- `doctor.profile.view` - View own doctor profile
- `patient.consultation.list` - List own consultations
- `superadmin.hospital.create` - Create new hospital (superadmin only)

**Usage:**
- Created by developers/admins
- Linked to roles via `role_permission` (global) or `hospital_role_permission` (hospital)
- Checked during API authorization

**Example Use Case:**
```sql
-- Get all permissions
SELECT * FROM permission_master ORDER BY permission_name;

-- Search permissions by keyword
SELECT * FROM permission_master WHERE permission_name LIKE '%doctor%';
```

---

### 8. **role_permission**
**Category:** Global Role-Permission Mapping

**Purpose:**
- Maps global roles to permissions
- Defines what global roles can do platform-wide

**Key Fields:**
- `role_id` (PK, FK) - Global role
- `permission_id` (PK, FK) - Permission

**Primary Key:** `(role_id, permission_id)`

**Usage:**
- Populated during system setup
- Modified by superadmin
- Used to determine user permissions based on global role

**Example Use Case:**
```sql
-- Get all permissions for 'doctor' global role
SELECT p.permission_name, p.description
FROM permission_master p
JOIN role_permission rp ON p.permission_id = rp.permission_id
JOIN role_master r ON rp.role_id = r.role_id
WHERE r.role_name = 'doctor';
```

---

### 9. **hospital_role_permission**
**Category:** Hospital Role-Permission Mapping

**Purpose:**
- Maps hospital-specific roles to permissions
- Each hospital can define different permissions for same role name

**Key Fields:**
- `hospital_role_id` (PK, FK) - Hospital role
- `permission_id` (PK, FK) - Permission

**Primary Key:** `(hospital_role_id, permission_id)`

**Usage:**
- Set during hospital onboarding (default permissions)
- Modified by hospital_admin
- Hospital A's "nurse" role can have different permissions than Hospital B's "nurse" role

**Example Use Case:**
```sql
-- Get permissions for hospital_admin in Hospital 1
SELECT p.permission_name
FROM permission_master p
JOIN hospital_role_permission hrp ON p.permission_id = hrp.permission_id
JOIN hospital_role hr ON hrp.hospital_role_id = hr.hospital_role_id
WHERE hr.hospital_id = 1 AND hr.role_name = 'hospital_admin';
```

---

### 10. **hospital_user_roles**
**Category:** User-Hospital-Role Association

**Purpose:**
- Links users to hospitals with specific hospital roles
- A user can have different roles in different hospitals
- Multi-tenant user assignment

**Key Fields:**
- `hospital_id` (PK, FK) - Hospital
- `user_id` (PK, FK) - User
- `hospital_role_id` (PK, FK) - Hospital role
- `assigned_on` - Assignment timestamp
- `is_active` - Active status (soft delete)

**Primary Key:** `(hospital_id, user_id, hospital_role_id)`

**Usage:**
- Created when user is added to a hospital
- A doctor can be a "doctor" at Hospital A and "hospital_admin" at Hospital B
- Used to determine hospital-specific permissions

**Example Use Case:**
```sql
-- Get all users in Hospital 1 with their roles
SELECT u.username, u.email, hr.role_name
FROM hospital_user_roles hur
JOIN users u ON hur.user_id = u.user_id
JOIN hospital_role hr ON hur.hospital_role_id = hr.hospital_role_id
WHERE hur.hospital_id = 1 AND hur.is_active = 1;
```

---

### 11. **user_permissions**
**Category:** Computed/Cached Permissions

**Purpose:**
- **Denormalized table** for fast permission lookups
- Pre-computed permissions from roles and direct grants
- Eliminates complex joins during authorization

**Key Fields:**
- `user_permission_id` (PK) - Unique identifier
- `user_id` (FK) - User
- `permission_id` (FK) - Permission
- `permission_name` - Cached permission name
- `scope` - 'global', 'hospital', or 'independent'
- `hospital_id` - Hospital context (if scope='hospital')
- `hospital_id_coalesced` - Computed column: coalesce(hospital_id, 0)

**Unique Constraint:** `(user_id, permission_id, hospital_id_coalesced, scope)`

**How It's Populated:**
1. When user is assigned a global role → inherit global role permissions
2. When user is assigned a hospital role → inherit hospital role permissions
3. When user is granted direct permission → add direct permission

**Usage:**
- Fast permission checks: `SELECT * FROM user_permissions WHERE user_id = ? AND permission_name = ?`
- Backend uses this for authorization
- Cached in Redis for even faster access (60s TTL)

**Example Use Case:**
```sql
-- Check if user has permission in hospital
SELECT * FROM user_permissions 
WHERE user_id = 123 
  AND permission_name = 'hospital.profile.view' 
  AND (hospital_id = 1 OR scope = 'global');
```

---

### 12. **user_direct_permissions**
**Category:** Direct Permission Grants

**Purpose:**
- Grant specific permissions to users directly (bypass roles)
- Temporary or exceptional access
- Track who granted the permission

**Key Fields:**
- `udp_id` (PK) - Unique identifier
- `user_id` (FK) - User receiving permission
- `permission_id` (FK) - Permission being granted
- `scope` - 'global', 'hospital', or 'independent'
- `hospital_id` - Hospital context (if applicable)
- `granted_by` - User ID who granted this permission
- `granted_on` - Grant timestamp

**Unique Constraint:** `(user_id, permission_id, hospital_id, scope)`

**Usage:**
- Used for exceptional access grants
- Useful for temporary elevated permissions
- Auditable (tracks who granted the permission)

**Example Use Case:**
```sql
-- Grant direct permission to a user
INSERT INTO user_direct_permissions 
(user_id, permission_id, scope, hospital_id, granted_by) 
VALUES (123, 45, 'hospital', 1, 1);

-- List direct permissions for a user
SELECT p.permission_name, udp.scope, udp.granted_by, udp.granted_on
FROM user_direct_permissions udp
JOIN permission_master p ON udp.permission_id = p.permission_id
WHERE udp.user_id = 123;
```

---

### 13. **doctor_hospitals** (Association Table)
**Category:** Doctor-Hospital Association

**Purpose:**
- Simple many-to-many association between doctors and hospitals
- Tracks which doctors work at which hospitals
- Lightweight alternative to `hospital_user_roles` for basic association

**Key Fields:**
- `user_id` (PK, FK) - Doctor user
- `hospital_id` (PK, FK) - Hospital

**Primary Key:** `(user_id, hospital_id)`

**Usage:**
- Links doctors to hospitals they can practice at
- Used for quick lookups: "Which hospitals does this doctor work at?"
- **Note:** `hospital_user_roles` is more comprehensive (includes role assignment)

**Example Use Case:**
```sql
-- Get all hospitals a doctor works at
SELECT h.* FROM hospital_master h
JOIN doctor_hospitals dh ON h.hospital_id = dh.hospital_id
WHERE dh.user_id = 123;

-- Get all doctors at a hospital
SELECT u.* FROM users u
JOIN doctor_hospitals dh ON u.user_id = dh.user_id
WHERE dh.hospital_id = 1;
```

---

### 14. **patient_hospitals**
**Category:** Patient-Hospital Registration

**Purpose:**
- Track which hospitals a patient is registered at
- Patient can be registered at multiple hospitals
- Registration history

**Key Fields:**
- `user_id` (PK, FK) - Patient user
- `hospital_id` (PK, FK) - Hospital
- `registered_on` - Registration date
- `is_active` - Active status

**Primary Key:** `(user_id, hospital_id)`

**Usage:**
- Created when patient registers at a hospital
- Can be deactivated (soft delete)
- Used to list patient's hospitals or hospital's patients

**Example Use Case:**
```sql
-- Get all hospitals a patient is registered at
SELECT h.hospital_name, ph.registered_on 
FROM hospital_master h
JOIN patient_hospitals ph ON h.hospital_id = ph.hospital_id
WHERE ph.user_id = 456 AND ph.is_active = 1;
```

---

## 🏥 Medical Specialties Tables

### 15. **specialties**
**Category:** Medical Specialties

**Purpose:**
- Master list of medical specialties/departments
- Used for consultation categorization
- Training templates for AI avatars

**Key Fields:**
- `specialty_id` (PK) - Unique identifier
- `name` (UNIQUE) - Specialty name (e.g., 'Cardiology', 'Neurology')
- `description` - Detailed description
- `status` - 'active' or 'inactive'
- `default_training_template` (JSON) - Default AI training config

**Common Specialties:**
- Cardiology
- Neurology
- Orthopedics
- Pediatrics
- Dermatology
- General Medicine
- Surgery

**Usage:**
- Created by superadmin or hospital_admin
- Assigned to doctors via `doctor_specialties`
- Used in consultation records

**Example Use Case:**
```sql
-- Get all active specialties
SELECT * FROM specialties WHERE status = 'active';

-- Search specialties
SELECT * FROM specialties WHERE name LIKE '%cardio%';
```

---

### 16. **doctor_specialties**
**Category:** Doctor-Specialty Mapping

**Purpose:**
- Maps doctors to their medical specialties
- A doctor can have multiple specialties
- Certification tracking

**Key Fields:**
- `doctor_specialty_id` (PK) - Unique identifier
- `user_id` (FK) - Doctor user
- `specialty_id` (FK) - Specialty
- `certified_date` - Certification date

**Unique Constraint:** `(user_id, specialty_id)`

**Usage:**
- Assigned during doctor onboarding or later
- Used for doctor search by specialty
- Displayed on doctor profile

**Example Use Case:**
```sql
-- Get all specialties for a doctor
SELECT s.name, ds.certified_date
FROM specialties s
JOIN doctor_specialties ds ON s.specialty_id = ds.specialty_id
WHERE ds.user_id = 123;

-- Find doctors by specialty
SELECT u.username, u.email
FROM users u
JOIN doctor_specialties ds ON u.user_id = ds.user_id
WHERE ds.specialty_id = 1;  -- Cardiology
```

---

## 💬 Consultation System Tables

### 17. **consultation**
**Category:** Consultation Records

**Purpose:**
- Main table for patient-doctor consultations
- Links patient, doctor, specialty, and hospital
- Tracks consultation lifecycle

**Key Fields:**
- `consultation_id` (PK) - Unique identifier
- `patient_id` (FK) - Patient user
- `doctor_id` (FK) - Doctor user
- `specialty_id` (FK) - Medical specialty
- `hospital_id` (FK) - Hospital (nullable for independent consultations)
- `consultation_date` - Date/time of consultation
- `consultation_type` - 'hospital' or 'independent'
- `status` - 'scheduled', 'ongoing', 'completed', 'cancelled'
- `total_duration` - Duration in seconds

**Consultation Types:**
- **hospital**: Consultation at a specific hospital
- **independent**: Private consultation (no hospital)

**Status Flow:**
- scheduled → ongoing → completed
- scheduled → cancelled

**Usage:**
- Created when consultation is scheduled
- Updated during consultation
- Used for analytics and reporting

**Example Use Case:**
```sql
-- Get patient's consultation history
SELECT c.*, 
       d.username as doctor_name,
       s.name as specialty_name,
       h.hospital_name
FROM consultation c
JOIN users d ON c.doctor_id = d.user_id
JOIN specialties s ON c.specialty_id = s.specialty_id
LEFT JOIN hospital_master h ON c.hospital_id = h.hospital_id
WHERE c.patient_id = 456
ORDER BY c.consultation_date DESC;
```

---

### 18. **consultation_sessions**
**Category:** Consultation Session Details

**Purpose:**
- Individual sessions within a consultation
- A consultation can have multiple sessions (follow-ups)
- Track AI usage per session

**Key Fields:**
- `session_id` (PK) - Unique identifier
- `consultation_id` (FK) - Parent consultation
- `session_start` - Session start time
- `session_end` - Session end time
- `session_type` - 'text', 'voice', or 'video'
- `total_tokens_used` - AI tokens consumed
- `total_api_calls` - Number of API calls
- `session_status` - 'active', 'completed', 'interrupted'

**Usage:**
- Created when session starts
- Updated during session (token count, API calls)
- Used for billing and analytics

**Example Use Case:**
```sql
-- Get all sessions for a consultation
SELECT * FROM consultation_sessions 
WHERE consultation_id = 789 
ORDER BY session_start DESC;

-- Calculate total tokens used
SELECT SUM(total_tokens_used) as total_tokens
FROM consultation_sessions
WHERE consultation_id = 789;
```

---

### 19. **consultation_messages**
**Category:** Chat Messages

**Purpose:**
- Store individual messages in a consultation session
- Chat history between patient and AI/doctor
- Audio message support

**Key Fields:**
- `message_id` (PK) - Unique identifier
- `session_id` (FK) - Parent session
- `sender_type` - 'patient', 'doctor', 'ai', 'system'
- `message_text` - Text content (LONGTEXT)
- `audio_url` - URL to audio file (if voice message)
- `processing_time_ms` - AI processing time
- `timestamp` - Message timestamp

**Usage:**
- Created for each message sent
- Retrieved for chat history display
- Used for transcript generation

**Example Use Case:**
```sql
-- Get chat history for a session
SELECT sender_type, message_text, timestamp
FROM consultation_messages
WHERE session_id = 1001
ORDER BY timestamp ASC;

-- Get AI response times
SELECT AVG(processing_time_ms) as avg_response_time
FROM consultation_messages
WHERE session_id = 1001 AND sender_type = 'ai';
```

---

### 20. **consultation_transcripts**
**Category:** Consultation Transcripts

**Purpose:**
- Store full consultation transcripts
- Permanent record of entire consultation
- Compliance and medical record keeping

**Key Fields:**
- `transcript_id` (PK) - Unique identifier
- `consultation_id` (FK) - Parent consultation
- `transcript_text` (LONGTEXT) - Full transcript
- `file_url` - URL to transcript file (PDF, etc.)
- `created_at` - Generation timestamp

**Usage:**
- Generated at end of consultation
- Used for medical records
- Can be downloaded by doctor/patient
- Legal/compliance requirements

**Example Use Case:**
```sql
-- Get transcript for a consultation
SELECT * FROM consultation_transcripts 
WHERE consultation_id = 789;

-- Get all transcripts for a patient
SELECT ct.*, c.consultation_date
FROM consultation_transcripts ct
JOIN consultation c ON ct.consultation_id = c.consultation_id
WHERE c.patient_id = 456;
```

---

### 21. **api_usage_logs**
**Category:** API Usage & Billing

**Purpose:**
- Track all external API calls (AI, TTS, STT, etc.)
- Usage-based billing
- Cost tracking per hospital/doctor/patient
- Performance monitoring

**Key Fields:**
- `usage_id` (PK) - Unique identifier
- `service_type` - 'stt', 'tts', 'llm', 'avatar_generation', etc.
- `hospital_id` (FK) - Hospital (for billing)
- `doctor_id` (FK) - Doctor (optional)
- `patient_id` (FK) - Patient (optional)
- `session_id` (FK) - Consultation session
- `tokens_used` - AI tokens consumed
- `api_calls` - Number of API calls
- `cost` - Cost in currency
- `response_time_ms` - API response time
- `status` - 'success', 'failed', 'timeout'
- `timestamp` - Log timestamp

**Usage:**
- Automatically logged on each API call
- Used for billing reports
- Performance analytics
- Cost optimization

**Example Use Case:**
```sql
-- Get API usage for a hospital in a month
SELECT service_type, 
       SUM(tokens_used) as total_tokens,
       SUM(cost) as total_cost,
       COUNT(*) as total_calls
FROM api_usage_logs
WHERE hospital_id = 1 
  AND timestamp >= '2025-10-01' 
  AND timestamp < '2025-11-01'
GROUP BY service_type;

-- Get doctor's usage
SELECT DATE(timestamp) as date,
       SUM(cost) as daily_cost
FROM api_usage_logs
WHERE doctor_id = 123
GROUP BY DATE(timestamp);
```

---

## 🤖 AI Avatar Features Tables

### 22. **doctor_avatars**
**Category:** AI Avatar Configuration

**Purpose:**
- Store doctor's AI avatar configurations
- Photo, voice samples, video for avatar generation
- Training status and progress
- Multiple avatars per doctor

**Key Fields:**
- `avatar_id` (PK) - Unique identifier
- `doctor_id` (FK) - Doctor user
- `avatar_name` - Avatar name/label
- `photo_url` - URL to doctor's photo
- `voice_sample_url` - URL to voice sample
- `avatar_video_url` - URL to generated avatar video
- `config_data` (JSON) - Avatar configuration
- `status` - 'pending', 'training', 'ready', 'failed'
- `training_progress` - Training progress (0-100)
- `is_active` - Active avatar flag

**Usage:**
- Created when doctor uploads photo/voice
- Updated during avatar training
- Used to select avatar for consultations
- A doctor can have multiple avatars (different styles)

**Example Use Case:**
```sql
-- Get doctor's active avatars
SELECT * FROM doctor_avatars 
WHERE doctor_id = 123 AND is_active = 1 AND status = 'ready';

-- Get avatars in training
SELECT * FROM doctor_avatars 
WHERE status = 'training' 
ORDER BY training_progress DESC;
```

---

## 📁 File Management Tables

### 23. **file_uploads**
**Category:** File Storage & Management

**Purpose:**
- Track all file uploads in the system
- Medical documents, images, PDFs, audio files
- File processing status
- Security and auditing

**Key Fields:**
- `file_id` (PK) - Unique identifier
- `uploaded_by` (FK) - User who uploaded
- `file_name` - Original filename
- `file_url` - URL to stored file
- `purpose` - 'avatar_photo', 'voice_sample', 'training_pdf', 'medical_record', etc.
- `file_type` - MIME type
- `file_size` - File size in bytes
- `processing_status` - 'uploaded', 'processing', 'completed', 'failed'
- `error_message` - Error details if failed

**File Purposes:**
- **avatar_photo**: Doctor photos for avatar
- **voice_sample**: Voice samples for avatar
- **training_pdf**: Medical knowledge PDFs
- **medical_record**: Patient medical documents
- **prescription**: Prescription images/PDFs

**Usage:**
- Created on file upload
- Updated during processing
- Used for file retrieval and management

**Example Use Case:**
```sql
-- Get all files uploaded by a user
SELECT * FROM file_uploads 
WHERE uploaded_by = 123 
ORDER BY created_at DESC;

-- Get pending files for processing
SELECT * FROM file_uploads 
WHERE processing_status = 'uploaded' 
  AND purpose = 'training_pdf';
```

---

## 🔔 Notifications Tables

### 24. **notifications**
**Category:** User Notifications

**Purpose:**
- Send notifications to users
- In-app notifications
- Track read/unread status
- Different notification types and categories

**Key Fields:**
- `notification_id` (PK) - Unique identifier
- `user_id` (FK) - Recipient user
- `title` - Notification title
- `message` - Notification message
- `type` - 'info', 'success', 'warning', 'error'
- `category` - 'avatar_training', 'consultation', 'system', 'billing'
- `is_read` - Read status (0/1)
- `action_url` - Optional URL to navigate to
- `created_at` - Creation timestamp

**Notification Types:**
- **info**: General information
- **success**: Success messages
- **warning**: Warnings
- **error**: Error notifications

**Notification Categories:**
- **avatar_training**: Avatar training updates
- **consultation**: Consultation-related
- **system**: System notifications
- **billing**: Billing alerts

**Usage:**
- Created by system events
- Retrieved by frontend for notification bell
- Marked as read by user

**Example Use Case:**
```sql
-- Get unread notifications for a user
SELECT * FROM notifications 
WHERE user_id = 123 AND is_read = 0 
ORDER BY created_at DESC;

-- Mark notification as read
UPDATE notifications 
SET is_read = 1 
WHERE notification_id = 456;

-- Get notification count by category
SELECT category, COUNT(*) as count
FROM notifications
WHERE user_id = 123 AND is_read = 0
GROUP BY category;
```

---

## 📝 Audit & Compliance Tables

### 25. **audit_logs** (READ-ONLY)
**Category:** Audit Trail

**Purpose:**
- Complete audit trail of all system operations
- Compliance and security
- Track who did what, when
- Before/after values for changes

**Key Fields:**
- `audit_id` (PK) - Unique identifier
- `event_type` - Event type (e.g., 'hospital.create', 'user.update')
- `entity_type` - Entity type (e.g., 'hospital', 'user', 'consultation')
- `entity_id` - ID of affected entity
- `user_actor` (FK) - User who performed the action
- `event_time` - Event timestamp
- `old_values` (JSON) - Previous values
- `new_values` (JSON) - New values
- `user_agent` - Browser/client user agent

**Event Types:**
- `{entity}.create` - Creation events
- `{entity}.update` - Update events
- `{entity}.delete` - Deletion events
- `{entity}.{action}` - Custom actions

**Usage:**
- **Automatically logged** by backend service
- **READ-ONLY** - Never modified or deleted
- Used for compliance audits
- Security investigations
- Track changes over time

**Example Use Case:**
```sql
-- Get audit trail for a hospital
SELECT * FROM audit_logs 
WHERE entity_type = 'hospital' AND entity_id = 1 
ORDER BY event_time DESC;

-- Get user's activity log
SELECT * FROM audit_logs 
WHERE user_actor = 123 
ORDER BY event_time DESC 
LIMIT 50;

-- Track changes to a user
SELECT event_type, event_time, old_values, new_values
FROM audit_logs
WHERE entity_type = 'user' AND entity_id = 456
ORDER BY event_time DESC;
```

---

## 📊 Table Summary

| # | Table Name | Category | Type | CRUD Operations |
|---|------------|----------|------|-----------------|
| 1 | hospital_master | Multi-Tenancy | Core | Full CRUD |
| 2 | users | User Management | Core | Full CRUD |
| 3 | user_details | User Management | Profile | Full CRUD |
| 4 | user_settings | User Management | Preferences | Full CRUD |
| 5 | role_master | RBAC | Global Roles | Read-Only (seeded) |
| 6 | hospital_role | RBAC | Hospital Roles | Full CRUD |
| 7 | permission_master | RBAC | Permissions | Read-Only (seeded) |
| 8 | role_permission | RBAC | Mapping | Read-Only (seeded) |
| 9 | hospital_role_permission | RBAC | Mapping | Full CRUD |
| 10 | hospital_user_roles | RBAC | Association | Full CRUD |
| 11 | user_permissions | RBAC | Computed | Auto-populated |
| 12 | user_direct_permissions | RBAC | Direct Grants | Full CRUD |
| 13 | doctor_hospitals | RBAC | Association | Full CRUD |
| 14 | patient_hospitals | RBAC | Association | Full CRUD |
| 15 | specialties | Medical | Master Data | Full CRUD |
| 16 | doctor_specialties | Medical | Mapping | Full CRUD |
| 17 | consultation | Consultation | Core | Full CRUD |
| 18 | consultation_sessions | Consultation | Sessions | Full CRUD |
| 19 | consultation_messages | Consultation | Messages | Create & Read |
| 20 | consultation_transcripts | Consultation | Transcripts | Create & Read |
| 21 | api_usage_logs | Analytics | Logs | Create & Read |
| 22 | doctor_avatars | AI Avatar | Configuration | Full CRUD |
| 23 | file_uploads | File Management | Storage | Full CRUD |
| 24 | notifications | Notifications | User Alerts | Create & Update |
| 25 | audit_logs | Audit | Compliance | Create & Read (Read-Only) |

---

## 🔄 Data Flow Examples

### Example 1: Doctor Registration & Assignment

```sql
-- 1. Create user
INSERT INTO users (username, email, password_hash, global_role_id) 
VALUES ('dr_smith', 'smith@hospital.com', '$2b$12$...', 2);  -- role_id 2 = doctor

-- 2. Create user details
INSERT INTO user_details (user_id, first_name, last_name, phone) 
VALUES (123, 'John', 'Smith', '+919876543210');

-- 3. Assign to hospital with role
INSERT INTO hospital_user_roles (hospital_id, user_id, hospital_role_id) 
VALUES (1, 123, 5);  -- hospital_role_id 5 = 'doctor' at Hospital 1

-- 4. Assign specialties
INSERT INTO doctor_specialties (user_id, specialty_id) 
VALUES (123, 1), (123, 3);  -- Cardiology and Neurology

-- 5. Log the action
INSERT INTO audit_logs (event_type, entity_type, entity_id, user_actor, new_values)
VALUES ('user.create', 'user', 123, 1, '{"username": "dr_smith", ...}');
```

### Example 2: Consultation Flow

```sql
-- 1. Create consultation
INSERT INTO consultation (patient_id, doctor_id, specialty_id, hospital_id, status)
VALUES (456, 123, 1, 1, 'scheduled');

-- 2. Start session when consultation begins
INSERT INTO consultation_sessions (consultation_id, session_type)
VALUES (789, 'video');

-- 3. Log messages during consultation
INSERT INTO consultation_messages (session_id, sender_type, message_text)
VALUES (1001, 'patient', 'Hello doctor, I have chest pain...');

INSERT INTO consultation_messages (session_id, sender_type, message_text)
VALUES (1001, 'doctor', 'Please describe the pain...');

-- 4. Log API usage
INSERT INTO api_usage_logs (service_type, session_id, tokens_used, cost)
VALUES ('llm', 1001, 500, 0.0025);

-- 5. End session
UPDATE consultation_sessions 
SET session_end = NOW(), session_status = 'completed'
WHERE session_id = 1001;

-- 6. Generate transcript
INSERT INTO consultation_transcripts (consultation_id, transcript_text)
VALUES (789, 'Full consultation transcript...');

-- 7. Complete consultation
UPDATE consultation 
SET status = 'completed', total_duration = 1800
WHERE consultation_id = 789;
```

---

## 🎯 Key Insights

### Multi-Tenancy Strategy
- **hospital_master** is the tenant table
- All tenant-specific data links back via `hospital_id`
- Users can belong to multiple tenants (hospitals)

### RBAC Hierarchy
```
Global Roles (role_master)
    ↓ assigned via users.global_role_id
Users (users)
    ↓ assigned via hospital_user_roles
Hospital Roles (hospital_role)
    ↓ permissions via hospital_role_permission
Permissions (permission_master)
```

### Performance Optimizations
- **user_permissions**: Denormalized for fast lookups
- **hospital_id_coalesced**: Computed column for efficient indexing
- **Redis caching**: 60s TTL on permission checks
- **Indexes**: Strategic indexes on foreign keys and frequent queries

### Data Integrity
- **Cascade Deletes**: Most foreign keys use CASCADE
- **Soft Deletes**: `is_active` flags prevent data loss
- **Audit Logging**: All critical operations logged
- **Unique Constraints**: Prevent duplicate data

---

## 📚 Additional Resources

- **Integration Guide**: `NEXTJS_BACKEND_INTEGRATION_COMPLETE_GUIDE.md`
- **Schema Reference**: `DATABASE_SCHEMA_AND_PERMISSIONS_REFERENCE.md`
- **Quick Start**: `QUICK_START_INTEGRATION.md`
- **API Documentation**: `http://localhost:8000/docs`

---

**Document Version**: 1.0  
**Last Updated**: October 20, 2025  
**Total Tables**: 25

