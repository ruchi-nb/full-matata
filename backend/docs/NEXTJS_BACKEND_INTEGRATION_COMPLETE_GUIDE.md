# Next.js Frontend - FastAPI Backend Integration Guide

## 📋 Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Database Structure](#database-structure)
3. [Authentication & Authorization](#authentication--authorization)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Frontend Integration Steps](#frontend-integration-steps)
6. [Code Examples](#code-examples)
7. [Error Handling](#error-handling)
8. [Security Best Practices](#security-best-practices)

---

## System Architecture Overview

### Multi-Tenant RBAC System

Your system implements a sophisticated **Multi-Tenant Role-Based Access Control (RBAC)** with:

- **Global Roles**: `superadmin`, `doctor`, `patient`
- **Hospital-Specific Roles**: `hospital_admin`, `doctor`, `nurse`, etc.
- **Permission-Based Access**: Fine-grained permissions for each operation
- **Multi-Tenancy**: Hospitals are isolated tenants with their own users and roles

```
┌─────────────────────────────────────────────────────────────┐
│                        SUPERADMIN                            │
│  (Platform-wide access, manages all hospitals)              │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────────┐     ┌───────▼──────────┐
│   Hospital A     │     │   Hospital B     │
│                  │     │                  │
│ - hospital_admin │     │ - hospital_admin │
│ - doctors        │     │ - doctors        │
│ - patients       │     │ - patients       │
│ - nurses         │     │ - nurses         │
└──────────────────┘     └──────────────────┘
```

---

## Database Structure

### Core Tables

#### 1. **Users Table**
Primary user table for all system users.

```sql
users:
  - user_id (PK)
  - username (UNIQUE)
  - email (UNIQUE)
  - password_hash
  - global_role_id (FK -> role_master.role_id)
  - created_at, updated_at
```

#### 2. **HospitalMaster Table**
Multi-tenant hospital entities.

```sql
hospital_master:
  - hospital_id (PK)
  - hospital_name (UNIQUE)
  - hospital_email
  - admin_contact
  - address
  - created_at, updated_at
```

#### 3. **RoleMaster Table**
Global platform roles.

```sql
role_master:
  - role_id (PK)
  - role_name (UNIQUE) - e.g., 'superadmin', 'doctor', 'patient'
  - role_scope ('platform')
  - parent_role_id
  - description
  - can_manage_roles (JSON)
```

#### 4. **HospitalRole Table**
Hospital-specific roles (tenant-level).

```sql
hospital_role:
  - hospital_role_id (PK)
  - hospital_id (FK -> hospital_master.hospital_id)
  - role_name - e.g., 'hospital_admin', 'doctor', 'nurse'
  - description
  - parent_hospital_role_id
  - is_active
```

#### 5. **PermissionMaster Table**
All available permissions in the system.

```sql
permission_master:
  - permission_id (PK)
  - permission_name (UNIQUE) - e.g., 'hospital.profile.view'
  - description
```

#### 6. **HospitalUserRoles Table**
Association between users, hospitals, and hospital roles.

```sql
hospital_user_roles:
  - hospital_id (PK, FK)
  - user_id (PK, FK)
  - hospital_role_id (PK, FK)
  - assigned_on
  - is_active
```

#### 7. **UserPermissions Table**
Computed/cached user permissions for fast access.

```sql
user_permissions:
  - user_permission_id (PK)
  - user_id (FK)
  - permission_id (FK)
  - permission_name
  - scope ('global', 'hospital', 'independent')
  - hospital_id (nullable)
  - granted_on
```

#### 8. **RolePermission Table**
Maps global roles to permissions.

```sql
role_permission:
  - role_id (PK, FK)
  - permission_id (PK, FK)
```

#### 9. **HospitalRolePermission Table**
Maps hospital roles to permissions.

```sql
hospital_role_permission:
  - hospital_role_id (PK, FK)
  - permission_id (PK, FK)
```

#### 10. **Specialties Table**
Medical specialties (Cardiology, Neurology, etc.).

```sql
specialties:
  - specialty_id (PK)
  - name (UNIQUE)
  - description
  - status ('active', 'inactive')
  - default_training_template (JSON)
```

#### 11. **Consultation Table**
Consultation records.

```sql
consultation:
  - consultation_id (PK)
  - patient_id (FK -> users.user_id)
  - doctor_id (FK -> users.user_id)
  - specialty_id (FK)
  - hospital_id (FK, nullable)
  - consultation_date
  - consultation_type ('hospital', 'independent')
  - status ('scheduled', 'ongoing', 'completed', 'cancelled')
  - total_duration
```

#### 12. **ConsultationSessions Table**
Individual consultation sessions.

```sql
consultation_sessions:
  - session_id (PK)
  - consultation_id (FK)
  - session_start, session_end
  - session_type ('text', 'voice', 'video')
  - total_tokens_used, total_api_calls
  - session_status ('active', 'completed', 'interrupted')
```

#### 13. **UserDetails Table**
Extended user profile information.

```sql
user_details:
  - user_id (PK, FK -> users.user_id)
  - first_name, last_name
  - dob, gender
  - phone, address
```

#### 14. **AuditLogs Table**
Audit trail for all operations (READ-ONLY).

```sql
audit_logs:
  - audit_id (PK)
  - event_type - e.g., 'hospital.create', 'user.update'
  - entity_type, entity_id
  - user_actor (FK -> users.user_id)
  - event_time
  - old_values (JSON), new_values (JSON)
  - user_agent
```

---

## Authentication & Authorization

### JWT Token Structure

#### Access Token Payload:
```json
{
  "user": {
    "user_id": 123,
    "username": "dr_smith",
    "email": "dr.smith@hospital.com",
    "global_role": {
      "role_id": 2,
      "role_name": "doctor"
    }
  },
  "jti": "unique-token-id",
  "exp": 1234567890,
  "refresh": false
}
```

#### Refresh Token Payload:
Same as access token but with `"refresh": true` and longer expiry.

### Authentication Flow

1. **Login** → `POST /auth/login`
2. **Receive Tokens** → Store `access_token` and `refresh_token`
3. **API Requests** → Send `Authorization: Bearer <access_token>`
4. **Token Expiry** → Use `refresh_token` to get new tokens → `POST /auth/refresh-token`
5. **Logout** → `POST /auth/logout` (revokes access token)

### Authorization Levels

1. **Global Role Check**: `require_global_roles(role_names=["superadmin"])`
2. **Hospital Role Check**: `require_hospital_roles(role_names=["hospital_admin"], hospital_id_param="hospital_id")`
3. **Permission Check**: `require_permissions(["hospital.profile.view"], hospital_id_param="hospital_id")`

### Permission Naming Convention

Pattern: `{resource}.{action}` or `{resource}.{sub_resource}.{action}`

Examples:
- `hospital.profile.view`
- `hospital.profile.update`
- `hospital.doctor.create`
- `doctor.profile.view`
- `patient.consultation.list`

---

## API Endpoints Reference

### Base URL
```
http://localhost:8000/api/v1  # or your production URL
```

---

### 🔐 Authentication Endpoints

#### 1. Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response 200:
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 4000
}
```

#### 2. Google OAuth Login
```http
POST /auth/google
Content-Type: application/json

{
  "credential": "google_oauth_token_here"
}

Response 200:
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 4000
}
```

#### 3. Refresh Token
```http
POST /auth/refresh-token
Authorization: Bearer <refresh_token>

Response 200:
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 4000
}
```

#### 4. Logout
```http
POST /auth/logout
Authorization: Bearer <access_token>

Response 200:
{
  "status": "ok",
  "message": "Logged out (access token revoked)"
}
```

#### 5. Get Current User Info
```http
GET /auth/me
Authorization: Bearer <access_token>

Response 200:
{
  "user_id": 123,
  "email": "user@example.com",
  "role": "doctor",
  "permissions": ["doctor.profile.view", ...],
  "token_valid": true
}
```

---

### 👤 Patient Endpoints

#### 1. Register Patient
```http
POST /auth/register/patient
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securepassword",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+919876543210",
  "hospital_id": 1  // optional
}

Response 201:
{
  "user_id": 45,
  "username": "john_doe",
  "email": "john@example.com",
  "next": "/login"
}
```

#### 2. Get Patient Profile
```http
GET /patients/profile
Authorization: Bearer <access_token>

Response 200:
{
  "user_id": 45,
  "first_name": "John",
  "last_name": "Doe",
  "dob": "1990-05-15",
  "gender": "male",
  "phone": "+919876543210",
  "address": "123 Main St"
}
```

#### 3. Update Patient Profile
```http
PUT /patients/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe Updated",
  "phone": "+919999999999"
}

Response 200:
{
  "user_id": 45,
  "first_name": "John",
  "last_name": "Doe Updated",
  ...
}
```

#### 4. List Patient Consultations
```http
GET /patients/consultations
Authorization: Bearer <access_token>

Response 200:
{
  "consultations": [
    {
      "consultation_id": 10,
      "patient_id": 45,
      "doctor_id": 12,
      "hospital_id": 1,
      "specialty_id": 3,
      "consultation_date": "2025-10-15T10:00:00",
      "status": "completed",
      "total_duration": 1800
    }
  ]
}
```

---

### 👨‍⚕️ Doctor Endpoints

#### 1. Get Doctor Profile
```http
GET /doctors/profile
Authorization: Bearer <access_token>

Response 200:
{
  "user_id": 12,
  "username": "dr_smith",
  "email": "dr.smith@hospital.com"
}
```

#### 2. Update Doctor Profile
```http
PUT /doctors/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "username": "dr_smith_updated",
  "email": "new.email@hospital.com"
}

Response 200:
{
  "user_id": 12,
  "username": "dr_smith_updated",
  "email": "new.email@hospital.com"
}
```

#### 3. Get Doctor Specialties
```http
GET /doctors/specialties
Authorization: Bearer <access_token>

Response 200:
[
  {
    "specialty_id": 1,
    "name": "Cardiology",
    "description": "Heart and cardiovascular system",
    "status": "active"
  }
]
```

#### 4. Update Doctor Specialties
```http
PUT /doctors/specialties
Authorization: Bearer <access_token>
Content-Type: application/json

[1, 3, 5]  // specialty_ids

Response 200:
[
  {"specialty_id": 1, "name": "Cardiology", ...},
  {"specialty_id": 3, "name": "Neurology", ...}
]
```

#### 5. List Patients (for Doctor)
```http
GET /doctors/patients
Authorization: Bearer <access_token>

Response 200:
[
  {
    "user_id": 45,
    "username": "john_doe",
    "email": "john@example.com"
  }
]
```

#### 6. Get Patient Details (for Doctor)
```http
GET /doctors/patients/{patient_id}
Authorization: Bearer <access_token>

Response 200:
{
  "user": {
    "user_id": 45,
    "username": "john_doe",
    "email": "john@example.com"
  },
  "details": {
    "first_name": "John",
    "last_name": "Doe",
    "dob": "1990-05-15",
    ...
  }
}
```

#### 7. Get Patient Consultations (for Doctor)
```http
GET /doctors/patients/{patient_id}/consultations
Authorization: Bearer <access_token>

Response 200:
{
  "consultations": [...]
}
```

---

### 🏥 Hospital Endpoints

#### 1. List Hospitals (Superadmin)
```http
GET /hospitals/
Authorization: Bearer <access_token>

Response 200:
[
  {
    "hospital_id": 1,
    "hospital_name": "Apollo Hospital",
    "hospital_email": "contact@apollo.com",
    "admin_contact": "+911234567890",
    "address": "Chennai, India",
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-10-01T00:00:00"
  }
]
```

#### 2. Create Hospital (Superadmin)
```http
POST /hospitals/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "hospital_name": "New Hospital",
  "hospital_email": "info@newhospital.com",
  "admin_contact": "+919999999999",
  "address": "Mumbai, India"
}

Response 201:
{
  "hospital_id": 5,
  "hospital_name": "New Hospital",
  ...
}
```

#### 3. Get Hospital Profile
```http
GET /hospitals/profile?hospital_id=1
Authorization: Bearer <access_token>

Response 200:
{
  "hospital_id": 1,
  "hospital_name": "Apollo Hospital",
  ...
}
```

#### 4. Update Hospital Profile
```http
PUT /hospitals/profile?hospital_id=1
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "hospital_name": "Apollo Hospital - Updated",
  "admin_contact": "+911111111111"
}

Response 200:
{
  "hospital_id": 1,
  "hospital_name": "Apollo Hospital - Updated",
  ...
}
```

#### 5. Delete Hospital (Superadmin)
```http
DELETE /hospitals/{hospital_id}
Authorization: Bearer <access_token>

Response 204: No Content
```

#### 6. List Specialties
```http
GET /hospitals/specialities?hospital_id=1
Authorization: Bearer <access_token>

Response 200:
[
  {
    "specialty_id": 1,
    "name": "Cardiology",
    "description": "Heart diseases",
    "status": "active"
  }
]
```

#### 7. Create Specialty
```http
POST /hospitals/specialities?hospital_id=1
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Orthopedics",
  "description": "Bone and joint diseases"
}

Response 201:
{
  "specialty_id": 10,
  "name": "Orthopedics",
  ...
}
```

#### 8. Update Specialty
```http
PUT /hospitals/specialities/{specialty_id}?hospital_id=1
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Orthopedics - Updated",
  "status": "active"
}

Response 200:
{
  "specialty_id": 10,
  "name": "Orthopedics - Updated",
  ...
}
```

#### 9. Delete Specialty
```http
DELETE /hospitals/specialities/{specialty_id}?hospital_id=1
Authorization: Bearer <access_token>

Response 204: No Content
```

#### 10. List Hospital Doctors
```http
GET /hospitals/doctors?hospital_id=1
Authorization: Bearer <access_token>

Response 200:
[
  {
    "user_id": 12,
    "username": "dr_smith",
    "email": "dr.smith@apollo.com",
    "global_role_id": 2
  }
]
```

#### 11. Add Doctor to Hospital
```http
POST /hospitals/doctors?hospital_id=1
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "doctor_user_id": 12,
  "hospital_role_id": 5
}

Response 201:
{
  "user_id": 12,
  "username": "dr_smith",
  ...
}
```

#### 12. Update Doctor in Hospital
```http
PUT /hospitals/doctors/{doctor_id}?hospital_id=1
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "username": "dr_smith_updated",
  "email": "new.email@apollo.com"
}

Response 200:
{
  "user_id": 12,
  "username": "dr_smith_updated",
  ...
}
```

#### 13. Remove Doctor from Hospital
```http
DELETE /hospitals/doctors/{doctor_id}?hospital_id=1
Authorization: Bearer <access_token>

Response 204: No Content
```

---

### 🔧 Superadmin Endpoints

#### 1. Onboard Hospital with Admin
```http
POST /superadmin/onboard/hospital_admin
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "hospital_name": "City Hospital",
  "hospital_email": "admin@cityhospital.com",
  "admin_email": "admin@cityhospital.com",
  "admin_password": "SecurePass123!",
  "admin_username": "cityadmin",
  "admin_first_name": "Admin",
  "admin_last_name": "User",
  "admin_phone": "+919876543210",
  "auto_login": false
}

Response 201:
{
  "message": "Hospital and admin created successfully.",
  "data": {
    "hospital_id": 5,
    "hospital_name": "City Hospital",
    "admin_user_id": 50,
    "admin_username": "cityadmin",
    "admin_email": "admin@cityhospital.com",
    "access_token": null,  // if auto_login=false
    "refresh_token": null,
    "expires_in": null
  }
}
```

#### 2. Create User for Hospital (Superadmin)
```http
POST /superadmin/hospitals/{hospital_id}/users
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "user_type": "doctor",  // or "patient"
  "username": "dr_new",
  "email": "dr.new@cityhospital.com",
  "password": "SecurePass123!",
  "first_name": "New",
  "last_name": "Doctor",
  "phone": "+919999999999"
}

Response 201:
{
  "user_id": 51,
  "username": "dr_new",
  "email": "dr.new@cityhospital.com",
  "hospital_id": 5,
  "global_role": "doctor",
  "tenant_role": "doctor"
}
```

#### 3. Get Superadmin Profile
```http
GET /superadmin/profile
Authorization: Bearer <access_token>

Response 200:
{
  "user_id": 1,
  "username": "superadmin",
  "email": "superadmin@platform.com",
  "global_role_id": 1,
  "created_at": "2024-01-01T00:00:00",
  "updated_at": "2024-10-01T00:00:00"
}
```

#### 4. Assign Permissions to All Doctors
```http
POST /superadmin/assign-doctor-permissions
Authorization: Bearer <access_token>

Response 200:
{
  "message": "Doctor permissions assignment completed",
  "results": {
    "processed": 50,
    "updated": 45,
    "failed": 5
  },
  "success": true
}
```

#### 5. Get Doctor Permissions Status
```http
GET /superadmin/doctor-permissions-status
Authorization: Bearer <access_token>

Response 200:
{
  "message": "Doctor permissions status retrieved successfully",
  "data": {
    "total_doctors": 50,
    "doctors_with_permissions": 45,
    ...
  }
}
```

---

### 🏥 Hospital Admin Endpoints

#### 1. Create User in Hospital
```http
POST /hospital-admin/hospitals/{hospital_id}/users
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "role_name": "nurse",
  "email": "nurse.jane@cityhospital.com",
  "password": "SecurePass123!",
  "username": "nurse_jane",
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "+919876543210"
}

Response 201:
{
  "user_id": 60,
  "username": "nurse_jane",
  "email": "nurse.jane@cityhospital.com",
  "hospital_id": 5,
  "tenant_role": "nurse"
}
```

#### 2. Create Custom Hospital Role
```http
POST /hospital-admin/hospitals/{hospital_id}/roles
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "role_name": "lab_technician",
  "description": "Lab technician role"
}

Response 201:
{
  "hospital_role_id": 20,
  "hospital_id": 5,
  "role_name": "lab_technician",
  "description": "Lab technician role"
}
```

#### 3. Assign Permissions to Hospital Role
```http
PUT /hospital-admin/hospitals/{hospital_id}/roles/{role_id}/permissions
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "permission_ids": [10, 11, 12]
}

Response 200:
{
  "status": "Permissions assigned successfully"
}
```

---

### 🔍 Search Endpoints

#### 1. Search Users (Hospital Scope)
```http
GET /search/users?q=smith&hospital_id=1
Authorization: Bearer <access_token>

Response 200:
[
  {
    "user_id": 12,
    "username": "dr_smith",
    "email": "dr.smith@hospital.com",
    "type": "doctor"
  }
]
```

---

## Frontend Integration Steps

### Step 1: Setup API Client

Create a centralized API client with interceptors for authentication.

**File: `src/services/api.js`**

```javascript
import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add access token
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = Cookies.get('access_token');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = Cookies.get('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${API_BASE_URL}/auth/refresh-token`,
            {},
            {
              headers: {
                Authorization: `Bearer ${refreshToken}`,
              },
            }
          );

          // Store new tokens
          Cookies.set('access_token', data.access_token, { expires: 7 });
          Cookies.set('refresh_token', data.refresh_token, { expires: 30 });

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          Cookies.remove('access_token');
          Cookies.remove('refresh_token');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token, redirect to login
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

---

### Step 2: Create API Service Functions

**File: `src/services/authService.js`**

```javascript
import apiClient from './api';
import Cookies from 'js-cookie';

export const authService = {
  // Login
  async login(email, password) {
    const { data } = await apiClient.post('/auth/login', { email, password });
    
    // Store tokens
    Cookies.set('access_token', data.access_token, { expires: 7 });
    Cookies.set('refresh_token', data.refresh_token, { expires: 30 });
    
    return data;
  },

  // Google OAuth Login
  async googleLogin(credential) {
    const { data } = await apiClient.post('/auth/google', { credential });
    
    // Store tokens
    Cookies.set('access_token', data.access_token, { expires: 7 });
    Cookies.set('refresh_token', data.refresh_token, { expires: 30 });
    
    return data;
  },

  // Logout
  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      Cookies.remove('access_token');
      Cookies.remove('refresh_token');
      window.location.href = '/login';
    }
  },

  // Get current user
  async getCurrentUser() {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!Cookies.get('access_token');
  },
};
```

**File: `src/services/hospitalService.js`**

```javascript
import apiClient from './api';

export const hospitalService = {
  // List all hospitals (superadmin)
  async listHospitals() {
    const { data } = await apiClient.get('/hospitals/');
    return data;
  },

  // Get hospital profile
  async getHospitalProfile(hospitalId) {
    const { data } = await apiClient.get(`/hospitals/profile?hospital_id=${hospitalId}`);
    return data;
  },

  // Update hospital profile
  async updateHospitalProfile(hospitalId, updates) {
    const { data } = await apiClient.put(
      `/hospitals/profile?hospital_id=${hospitalId}`,
      updates
    );
    return data;
  },

  // List specialties
  async listSpecialties(hospitalId) {
    const { data } = await apiClient.get(`/hospitals/specialities?hospital_id=${hospitalId}`);
    return data;
  },

  // Create specialty
  async createSpecialty(hospitalId, specialty) {
    const { data } = await apiClient.post(
      `/hospitals/specialities?hospital_id=${hospitalId}`,
      specialty
    );
    return data;
  },

  // List doctors in hospital
  async listDoctors(hospitalId) {
    const { data } = await apiClient.get(`/hospitals/doctors?hospital_id=${hospitalId}`);
    return data;
  },

  // Add doctor to hospital
  async addDoctor(hospitalId, doctorData) {
    const { data } = await apiClient.post(
      `/hospitals/doctors?hospital_id=${hospitalId}`,
      doctorData
    );
    return data;
  },
};
```

**File: `src/services/doctorService.js`**

```javascript
import apiClient from './api';

export const doctorService = {
  // Get doctor profile
  async getProfile() {
    const { data } = await apiClient.get('/doctors/profile');
    return data;
  },

  // Update doctor profile
  async updateProfile(updates) {
    const { data } = await apiClient.put('/doctors/profile', updates);
    return data;
  },

  // Get doctor specialties
  async getSpecialties() {
    const { data } = await apiClient.get('/doctors/specialties');
    return data;
  },

  // Update doctor specialties
  async updateSpecialties(specialtyIds) {
    const { data } = await apiClient.put('/doctors/specialties', specialtyIds);
    return data;
  },

  // List patients
  async listPatients() {
    const { data } = await apiClient.get('/doctors/patients');
    return data;
  },

  // Get patient details
  async getPatientDetails(patientId) {
    const { data } = await apiClient.get(`/doctors/patients/${patientId}`);
    return data;
  },

  // Get patient consultations
  async getPatientConsultations(patientId) {
    const { data } = await apiClient.get(`/doctors/patients/${patientId}/consultations`);
    return data;
  },
};
```

**File: `src/services/patientService.js`**

```javascript
import apiClient from './api';

export const patientService = {
  // Register patient
  async register(userData) {
    const { data } = await apiClient.post('/auth/register/patient', userData);
    return data;
  },

  // Get patient profile
  async getProfile() {
    const { data } = await apiClient.get('/patients/profile');
    return data;
  },

  // Update patient profile
  async updateProfile(updates) {
    const { data } = await apiClient.put('/patients/profile', updates);
    return data;
  },

  // List patient consultations
  async listConsultations() {
    const { data } = await apiClient.get('/patients/consultations');
    return data.consultations;
  },
};
```

---

### Step 3: Create Authentication Context

**File: `src/contexts/AuthContext.js`**

```javascript
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '@/services/authService';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      if (authService.isAuthenticated()) {
        const userData = await authService.getCurrentUser();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    await authService.login(email, password);
    await loadUser();
    return user;
  };

  const googleLogin = async (credential) => {
    await authService.googleLogin(credential);
    await loadUser();
    return user;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    router.push('/login');
  };

  const value = {
    user,
    loading,
    login,
    googleLogin,
    logout,
    isAuthenticated: !!user,
    hasRole: (role) => user?.role === role,
    hasPermission: (permission) => user?.permissions?.includes(permission),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

---

### Step 4: Create Protected Route Component

**File: `src/components/common/ProtectedRoute.jsx`**

```javascript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProtectedRoute({ children, requiredRole = null, requiredPermission = null }) {
  const { user, loading, isAuthenticated, hasRole, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }

      if (requiredRole && !hasRole(requiredRole)) {
        router.push('/unauthorized');
        return;
      }

      if (requiredPermission && !hasPermission(requiredPermission)) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [loading, isAuthenticated, user, requiredRole, requiredPermission]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return null;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return null;
  }

  return <>{children}</>;
}
```

---

### Step 5: Example Page Components

**File: `src/app/admin/dashboard/page.js`**

```javascript
'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { hospitalService } from '@/services/hospitalService';

export default function AdminDashboard() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHospitals();
  }, []);

  const loadHospitals = async () => {
    try {
      const data = await hospitalService.listHospitals();
      setHospitals(data);
    } catch (error) {
      console.error('Failed to load hospitals:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="superadmin">
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        
        {loading ? (
          <p>Loading hospitals...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hospitals.map((hospital) => (
              <div key={hospital.hospital_id} className="border rounded-lg p-4 shadow">
                <h3 className="font-semibold">{hospital.hospital_name}</h3>
                <p className="text-sm text-gray-600">{hospital.hospital_email}</p>
                <p className="text-sm text-gray-600">{hospital.address}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
```

**File: `src/app/doctorportal/dashboard/page.js`**

```javascript
'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { doctorService } from '@/services/doctorService';

export default function DoctorDashboard() {
  const [profile, setProfile] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileData, patientsData] = await Promise.all([
        doctorService.getProfile(),
        doctorService.listPatients(),
      ]);
      setProfile(profileData);
      setPatients(patientsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="doctor">
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Doctor Dashboard</h1>
        
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <div className="mb-6 p-4 bg-blue-50 rounded">
              <h2 className="font-semibold">Welcome, Dr. {profile?.username}</h2>
              <p className="text-sm text-gray-600">{profile?.email}</p>
            </div>

            <h2 className="text-xl font-semibold mb-3">Your Patients</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {patients.map((patient) => (
                <div key={patient.user_id} className="border rounded-lg p-4">
                  <h3 className="font-semibold">{patient.username}</h3>
                  <p className="text-sm text-gray-600">{patient.email}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
```

**File: `src/app/patientportal/dashboard/page.js`**

```javascript
'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { patientService } from '@/services/patientService';

export default function PatientDashboard() {
  const [profile, setProfile] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileData, consultationsData] = await Promise.all([
        patientService.getProfile(),
        patientService.listConsultations(),
      ]);
      setProfile(profileData);
      setConsultations(consultationsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="patient">
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Patient Portal</h1>
        
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <div className="mb-6 p-4 bg-green-50 rounded">
              <h2 className="font-semibold">Welcome, {profile?.first_name} {profile?.last_name}</h2>
              <p className="text-sm text-gray-600">{profile?.email}</p>
              <p className="text-sm text-gray-600">Phone: {profile?.phone}</p>
            </div>

            <h2 className="text-xl font-semibold mb-3">Your Consultations</h2>
            <div className="space-y-3">
              {consultations.map((consultation) => (
                <div key={consultation.consultation_id} className="border rounded-lg p-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold">Consultation #{consultation.consultation_id}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(consultation.consultation_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${
                        consultation.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {consultation.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
```

---

## Error Handling

### API Error Responses

The backend returns consistent error responses:

```json
{
  "detail": "Error message here",
  "error_code": "OPTIONAL_ERROR_CODE",
  "context": {
    "additional": "context data"
  }
}
```

### Error Handling in Frontend

**File: `src/utils/errorHandler.js`**

```javascript
export function handleApiError(error) {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;

    switch (status) {
      case 400:
        return data.detail || 'Bad request';
      case 401:
        return 'Unauthorized. Please login again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'Resource not found.';
      case 422:
        return data.detail || 'Validation error.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return data.detail || 'An error occurred.';
    }
  } else if (error.request) {
    // Request made but no response
    return 'Network error. Please check your connection.';
  } else {
    // Error in request setup
    return error.message || 'An unexpected error occurred.';
  }
}
```

**Usage in Components:**

```javascript
import { handleApiError } from '@/utils/errorHandler';
import { toast } from 'react-hot-toast'; // or your preferred notification library

try {
  await hospitalService.updateHospitalProfile(hospitalId, updates);
  toast.success('Hospital updated successfully!');
} catch (error) {
  const errorMessage = handleApiError(error);
  toast.error(errorMessage);
}
```

---

## Security Best Practices

### 1. **Token Storage**
- Store tokens in **HTTP-only cookies** for production (prevents XSS attacks)
- Current implementation uses `js-cookie` for development convenience

### 2. **CORS Configuration**
Backend already has CORS configured. Update your `.env`:

```env
CORS_ORIGINS=["http://localhost:3000", "https://your-frontend-domain.com"]
```

### 3. **Environment Variables**
Never expose sensitive data in frontend code.

**`.env.local` (Frontend):**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

### 4. **Input Validation**
Always validate user inputs on the frontend before sending to backend.

### 5. **Permission-Based Rendering**
Hide UI elements based on user permissions:

```javascript
import { useAuth } from '@/contexts/AuthContext';

export default function MyComponent() {
  const { hasPermission } = useAuth();

  return (
    <div>
      {hasPermission('hospital.doctor.create') && (
        <button>Add Doctor</button>
      )}
    </div>
  );
}
```

---

## Testing API Endpoints

### Using Postman/Thunder Client

1. **Login and get tokens:**
```http
POST http://localhost:8000/auth/login
Content-Type: application/json

{
  "email": "superadmin@platform.com",
  "password": "your-password"
}
```

2. **Copy the `access_token` from response**

3. **Use token in subsequent requests:**
```http
GET http://localhost:8000/hospitals/
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Deployment Checklist

### Backend (.env)
```env
DATABASE_URL=mysql+aiomysql://user:pass@host:3306/dbname
JWT_SECRET=strong-random-secret-for-production
CORS_ORIGINS=["https://your-frontend-domain.com"]
ENVIRONMENT=production
DEBUG=False
SHOW_ERRORS=False
ENFORCE_TRUSTED_IPS=False
```

### Frontend (.env.production)
```env
NEXT_PUBLIC_API_URL=https://api.your-backend-domain.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-production-google-client-id
```

---

## Additional Resources

- **Backend Swagger Docs**: `http://localhost:8000/docs`
- **Backend Code**: `/backend/` directory
- **Database Schema**: `/backend/models/models.py`
- **API Routes**: `/backend/routes/` directory
- **Services**: `/backend/service/` directory

---

## Support & Troubleshooting

### Common Issues

#### 1. **CORS Errors**
- Check `CORS_ORIGINS` in backend `.env`
- Ensure frontend URL is whitelisted

#### 2. **401 Unauthorized**
- Check if token is being sent in `Authorization` header
- Verify token hasn't expired
- Check if refresh token logic is working

#### 3. **403 Forbidden**
- User doesn't have required permissions
- Check user's roles and permissions in database

#### 4. **422 Validation Error**
- Request body doesn't match expected schema
- Check API documentation for required fields

---

## Conclusion

This guide provides a complete reference for integrating your Next.js frontend with the FastAPI backend. The backend implements a robust multi-tenant RBAC system with comprehensive API endpoints for all operations.

**Key Takeaways:**
✅ Multi-tenant hospital management
✅ JWT-based authentication with refresh tokens
✅ Role-based and permission-based access control
✅ Comprehensive CRUD operations for all entities
✅ Audit logging for all operations
✅ Production-ready error handling

For any questions or issues, refer to the backend documentation at `/backend/docs/` or the Swagger UI at `http://localhost:8000/docs`.

---

**Document Version**: 1.0  
**Last Updated**: October 20, 2025  
**Backend Version**: 1.0.0

