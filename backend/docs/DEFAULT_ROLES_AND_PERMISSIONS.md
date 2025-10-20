# Default Roles and Permissions

## 📋 Overview

Your system has **4 default roles** with specific access levels and permissions. This document provides a complete reference for each role's capabilities.

---

## 🏗️ Role Hierarchy

```
                    ┌─────────────────────┐
                    │   SUPER ADMIN       │
                    │  (Platform Level)   │
                    │  ALL PERMISSIONS    │
                    └──────────┬──────────┘
                               │
                               │ Can manage all hospitals
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼────────┐    ┌────────▼────────┐    ┌──────▼────────┐
│  Hospital A    │    │  Hospital B     │    │  Hospital C   │
│                │    │                 │    │               │
│ Hospital Admin │    │ Hospital Admin  │    │ Hospital Admin│
└───────┬────────┘    └────────┬────────┘    └──────┬────────┘
        │                      │                     │
        ├─────────┬────────────┼─────────┬───────────┤
        │         │            │         │           │
   ┌────▼───┐ ┌──▼─────┐ ┌────▼───┐ ┌──▼─────┐ ┌───▼────┐
   │ Doctor │ │Patient │ │ Doctor │ │Patient │ │ Doctor │
   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

---

## 1. Super Admin (Platform Level)

### Role Information
- **Role Name:** `superadmin`
- **Role ID:** 1
- **Scope:** `platform` (global)
- **Level:** Platform-wide access
- **Database Table:** `role_master`

### Key Characteristics
- ✅ **Short-circuited in all APIs** - Bypasses permission checks via `allow_super_admin=True`
- ✅ **Platform-wide access** - Can access all hospitals and data
- ✅ **Cannot be restricted** - Superadmin always has full access
- ✅ **Seeded in database** - Created during initial setup

### Capabilities

#### ✅ CAN DO (Everything)

**Hospital Management:**
- Create new hospitals
- View all hospitals
- Update any hospital profile
- Delete hospitals
- Onboard hospital admins

**User Management:**
- Create users (doctors, patients, admins) for any hospital
- View all users across all hospitals
- Update any user information
- Delete users
- Assign global roles
- Assign hospital roles

**Role & Permission Management:**
- View all roles (global and hospital-specific)
- Create global roles (though typically seeded)
- Modify role permissions
- View permission master
- Create/modify permissions (though typically seeded)

**Hospital-Specific Operations:**
- Perform any hospital admin operation on any hospital
- Perform any doctor operation as any doctor
- Perform any patient operation as any patient

**System Operations:**
- View all audit logs
- View all API usage logs
- Access system analytics
- System configuration

**Direct API Access:**
- All authentication endpoints
- All patient endpoints
- All doctor endpoints
- All hospital endpoints
- All superadmin endpoints
- All hospital admin endpoints
- All search endpoints

#### ❌ CANNOT DO
- **Nothing is restricted** - Superadmin has complete access

### API Endpoints Accessible

**All endpoints** across all routers:
- `/auth/*` - Authentication
- `/patients/*` - Patient operations
- `/doctors/*` - Doctor operations
- `/hospitals/*` - Hospital operations
- `/superadmin/*` - Superadmin operations
- `/hospital-admin/*` - Hospital admin operations
- `/search/*` - Search operations

### Default Permissions

**Superadmin has ALL permissions by default** through short-circuit mechanism.

```python
# In backend code
if is_super_admin(user):
    return user  # Bypasses all permission checks
```

### Sample Use Cases

```sql
-- Create superadmin user
INSERT INTO users (username, email, password_hash, global_role_id)
VALUES ('superadmin', 'admin@platform.com', '$2b$12$...', 1);

-- Superadmin creates a new hospital
POST /superadmin/onboard/hospital_admin
{
  "hospital_name": "New Hospital",
  "hospital_email": "admin@newhospital.com",
  "admin_email": "admin@newhospital.com",
  "admin_password": "SecurePass123!"
}

-- Superadmin creates user for any hospital
POST /superadmin/hospitals/{hospital_id}/users
{
  "user_type": "doctor",
  "email": "doctor@hospital.com",
  "password": "SecurePass123!"
}
```

---

## 2. Hospital Admin (Tenant Level)

### Role Information
- **Role Name:** `hospital_admin`
- **Role ID:** Varies (hospital-specific)
- **Scope:** `hospital` (tenant-level)
- **Level:** Hospital-specific access
- **Database Table:** `hospital_role`

### Key Characteristics
- ✅ **Tenant-level admin** - Full control within their hospital
- ✅ **Role management** - Can create and manage hospital roles
- ✅ **Permission mapping** - Can map roles to permissions
- ❌ **Cannot edit permission master** - Cannot create new permissions
- ✅ **User management** - Can add doctors and patients

### Capabilities

#### ✅ CAN DO

**Within Their Hospital:**

**User Management:**
- Add doctors to hospital
- Add patients to hospital
- Update user-hospital associations
- Assign hospital roles to users
- Deactivate users in hospital (soft delete)
- View all users in hospital

**Role Management:**
- Create custom hospital roles (e.g., "nurse", "receptionist", "lab_tech")
- Update hospital role descriptions
- Deactivate hospital roles
- View all hospital roles

**Permission Management:**
- **View** permission master (read-only)
- **Map** existing permissions to hospital roles
- **Cannot create** new permissions in permission_master
- **Cannot modify** permission definitions

**Hospital Profile:**
- View hospital profile
- Update hospital information (name, email, address, contact)

**Specialty Management:**
- Create specialties for hospital
- Update specialties
- Delete specialties
- View all specialties

**Doctor Management:**
- Add doctors to hospital with specific roles
- Update doctor information
- Assign specialties to doctors
- Remove doctors from hospital
- View doctor list

**Patient Management:**
- Register patients to hospital
- View patient list
- Update patient hospital association

**Analytics:**
- View hospital analytics
- View API usage for hospital
- View consultation statistics

#### ❌ CANNOT DO

**Restrictions:**
- ❌ Cannot access other hospitals' data
- ❌ Cannot create/modify/delete entries in `permission_master` table
- ❌ Cannot create global roles
- ❌ Cannot create new hospitals
- ❌ Cannot modify global role permissions
- ❌ Cannot access platform-wide analytics
- ❌ Cannot view audit logs of other hospitals

### Default Permissions

```
Hospital Profile:
- hospital.profile.view
- hospital.profile.update

User Management:
- hospital.user.create
- hospital.user.view
- hospital.user.update
- hospital.user.delete
- hospital.users.list

Doctor Management:
- hospital.doctor.create
- hospital.doctor.update
- hospital.doctor.delete
- hospital.doctors.list
- hospital.doctor.specialty.assign

Patient Management:
- hospital.patient.create
- hospital.patient.update
- hospital.patient.delete
- hospital.patients.list

Role Management:
- hospital.role.create
- hospital.role.update
- hospital.role.delete
- hospital.roles.list
- hospital.role.permission.assign
- hospital.role.permission.view

Permission Viewing (Read-Only):
- hospital.permission.list
- hospital.permission.view

Specialty Management:
- hospital.speciality.create
- hospital.speciality.update
- hospital.speciality.delete
- hospital.specialities.list

Analytics:
- hospital.analytics.view
- hospital.usage.view
```

### API Endpoints Accessible

**Hospital Admin Endpoints:**
```
POST   /hospital-admin/hospitals/{hospital_id}/users
POST   /hospital-admin/hospitals/{hospital_id}/roles
PUT    /hospital-admin/hospitals/{hospital_id}/roles/{role_id}/permissions
```

**Hospital Endpoints (with hospital_id context):**
```
GET    /hospitals/profile?hospital_id={id}
PUT    /hospitals/profile?hospital_id={id}
POST   /hospitals/doctors?hospital_id={id}
GET    /hospitals/doctors?hospital_id={id}
PUT    /hospitals/doctors/{doctor_id}?hospital_id={id}
DELETE /hospitals/doctors/{doctor_id}?hospital_id={id}
POST   /hospitals/specialities?hospital_id={id}
GET    /hospitals/specialities?hospital_id={id}
```

### Sample Use Cases

```sql
-- Hospital admin creates a custom role
POST /hospital-admin/hospitals/1/roles
{
  "role_name": "nurse",
  "description": "Nursing staff with patient care access"
}

-- Hospital admin assigns permissions to the role
PUT /hospital-admin/hospitals/1/roles/10/permissions
{
  "permission_ids": [15, 16, 17, 18]  // Existing permission IDs
}

-- Hospital admin adds a doctor
POST /hospital-admin/hospitals/1/users
{
  "role_name": "doctor",
  "email": "dr.new@hospital.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe"
}

-- Hospital admin assigns doctor to specialty
POST /hospitals/doctors?hospital_id=1
{
  "doctor_user_id": 123,
  "hospital_role_id": 5
}
```

### Important Notes

**Cannot modify permission_master:**
```sql
-- ❌ This is NOT allowed for hospital_admin
INSERT INTO permission_master (permission_name, description)
VALUES ('new.permission', 'New permission');

-- ✅ This IS allowed - map existing permission
INSERT INTO hospital_role_permission (hospital_role_id, permission_id)
VALUES (10, 25);  -- Map existing permission_id 25 to role 10
```

---

## 3. Doctor (Tenant Level)

### Role Information
- **Role Name:** `doctor`
- **Global Role ID:** 2 (in `role_master`)
- **Hospital Role:** Varies per hospital (in `hospital_role`)
- **Scope:** `hospital` (tenant-level, inside specific hospital)
- **Level:** Hospital-specific access
- **Database Tables:** `role_master` (global), `hospital_role` (tenant), `hospital_user_roles` (assignment)

### Key Characteristics
- ✅ **Multi-hospital** - Can work at multiple hospitals with different roles
- ✅ **Patient access** - Can view patients they've consulted with
- ✅ **Consultation management** - Can create and manage consultations
- ✅ **Self-service** - Can update own profile and specialties
- ❌ **Limited to own data** - Cannot access other doctors' patients/consultations

### Capabilities

#### ✅ CAN DO

**Profile Management (Self):**
- View own doctor profile
- Update own username and email
- Update own details (first name, last name, phone, address)
- View own specialties
- Update own specialties

**Patient Management (Read-Only for own patients):**
- List patients they have consulted with
- View patient details (for patients they've consulted)
- View patient consultation history (for their own consultations)

**Consultation Management:**
- Create new consultations
- View own consultations
- Update consultation status
- Start/end consultation sessions
- Send messages in consultation
- View consultation transcripts

**Specialty Information:**
- View all available specialties
- Assign specialties to self

**Analytics (Self):**
- View own patient analytics
- View monthly consultation statistics
- View own API usage

#### ❌ CANNOT DO

**Restrictions:**
- ❌ Cannot view other doctors' patients
- ❌ Cannot view other doctors' consultations
- ❌ Cannot create/modify users
- ❌ Cannot create/modify roles
- ❌ Cannot manage hospital settings
- ❌ Cannot access hospital-wide analytics
- ❌ Cannot manage specialties (view only)
- ❌ Cannot add other doctors or patients to hospital
- ❌ Cannot view audit logs
- ❌ Cannot access patients they haven't consulted with

### Default Permissions

```
Profile (Self):
- doctor.profile.view
- doctor.profile.update
- doctor.specialties.view
- doctor.specialties.update

Patients (Own):
- doctor.patients.list            // Only patients they've consulted
- doctor.patient.view             // Only their patients
- doctor.patient.consultations.list

Consultations (Own):
- doctor.consultation.create
- doctor.consultation.view        // Own consultations only
- doctor.consultation.update      // Own consultations only
- doctor.consultation.transcript.view

Analytics (Self):
- doctor.analytics.patients       // Own patient stats
- doctor.consultations.monthly    // Own consultation stats

Specialties (View Only):
- hospital.specialities.list      // View available specialties
```

### API Endpoints Accessible

**Doctor Endpoints:**
```
GET    /doctors/profile
PUT    /doctors/profile
GET    /doctors/specialties
PUT    /doctors/specialties
GET    /doctors/patients
GET    /doctors/patients/{patient_id}
GET    /doctors/patients/{patient_id}/consultations
GET    /doctors/analytics/patients
GET    /doctors/consultations/monthly
```

**Hospital Endpoints (Read-Only):**
```
GET    /hospitals/specialities?hospital_id={id}
```

### Sample Use Cases

```sql
-- Doctor updates own profile
PUT /doctors/profile
{
  "username": "dr_smith_updated",
  "email": "new.email@hospital.com"
}

-- Doctor updates own specialties
PUT /doctors/specialties
[1, 3, 5]  // Cardiology, Neurology, Orthopedics

-- Doctor views their patients
GET /doctors/patients
Response: [
  {
    "user_id": 456,
    "username": "john_doe",
    "email": "john@example.com"
  }
]

-- Doctor views patient details (only if they've consulted)
GET /doctors/patients/456
Response: {
  "user": {...},
  "details": {...}
}

-- Doctor views monthly consultation stats
GET /doctors/consultations/monthly
Response: {
  "series": [
    {"month": "Oct", "count": 25},
    {"month": "Nov", "count": 30}
  ]
}
```

### Important Notes

**Doctor at Multiple Hospitals:**
```sql
-- Doctor can be assigned to multiple hospitals
-- Hospital A
INSERT INTO hospital_user_roles (hospital_id, user_id, hospital_role_id)
VALUES (1, 123, 5);  -- Doctor role at Hospital 1

-- Hospital B (same doctor, different hospital)
INSERT INTO hospital_user_roles (hospital_id, user_id, hospital_role_id)
VALUES (2, 123, 7);  -- Doctor role at Hospital 2

-- Doctor could even be hospital_admin at one hospital and doctor at another
INSERT INTO hospital_user_roles (hospital_id, user_id, hospital_role_id)
VALUES (3, 123, 2);  -- Hospital Admin role at Hospital 3
```

**Data Access Restrictions:**
```sql
-- ✅ Doctor CAN access
SELECT * FROM consultation WHERE doctor_id = 123;

-- ❌ Doctor CANNOT access
SELECT * FROM consultation WHERE doctor_id != 123;  // Other doctors' consultations

-- ✅ Doctor CAN access their patients
SELECT u.* FROM users u
JOIN consultation c ON u.user_id = c.patient_id
WHERE c.doctor_id = 123;

-- ❌ Doctor CANNOT access patients they haven't consulted
SELECT u.* FROM users u
WHERE u.user_id NOT IN (
  SELECT patient_id FROM consultation WHERE doctor_id = 123
);
```

---

## 4. Patient (Tenant Level)

### Role Information
- **Role Name:** `patient`
- **Global Role ID:** 3 (in `role_master`)
- **Hospital Role:** Varies per hospital (in `hospital_role`)
- **Scope:** `hospital` (tenant-level, associated with specific hospitals)
- **Level:** Self-service access only
- **Database Tables:** `role_master` (global), `patient_hospitals` (hospital associations)

### Key Characteristics
- ✅ **Multi-hospital** - Can register at multiple hospitals
- ✅ **View-only** - Can view specialties and doctors
- ✅ **Consultation** - Can consult with doctors and download transcripts
- ✅ **Self-service** - Can update own profile
- ❌ **Limited access** - Cannot access other patients' data

### Capabilities

#### ✅ CAN DO

**Profile Management (Self):**
- View own patient profile
- Update own details (first name, last name, phone, address, DOB, gender)
- View own settings
- Update notification preferences

**Hospital Discovery:**
- View hospitals they're registered at
- View specialties available at their hospitals
- View doctors by specialty at their hospitals
- View doctor profiles

**Consultation:**
- Create consultation request with a doctor
- View own consultations (all of them)
- View consultation details
- View consultation transcripts
- Download consultation transcripts
- Participate in ongoing consultations (send messages)

**Specialty Information:**
- View all specialties at associated hospitals
- View doctors in specific specialties

#### ❌ CANNOT DO

**Restrictions:**
- ❌ Cannot view other patients' data
- ❌ Cannot view other patients' consultations
- ❌ Cannot create/modify users
- ❌ Cannot create/modify roles
- ❌ Cannot manage hospital settings
- ❌ Cannot view doctors at hospitals they're not registered at
- ❌ Cannot create specialties
- ❌ Cannot modify consultation data (except participate)
- ❌ Cannot view audit logs
- ❌ Cannot access analytics

### Default Permissions

```
Profile (Self):
- patient.profile.view
- patient.profile.update
- patient.settings.view
- patient.settings.update

Consultations (Own):
- patient.consultation.create
- patient.consultation.view       // Own consultations only
- patient.consultation.list       // Own consultations only
- patient.consultation.transcript.view
- patient.consultation.transcript.download

Hospital Information (Read-Only):
- hospital.specialities.list      // At associated hospitals only
- hospital.doctors.list           // At associated hospitals only
- hospital.doctor.view            // At associated hospitals only

Discovery:
- patient.hospitals.list          // Hospitals they're registered at
- patient.specialty.doctors.list  // Doctors by specialty
```

### API Endpoints Accessible

**Patient Endpoints:**
```
POST   /auth/register/patient
GET    /patients/profile
PUT    /patients/profile
GET    /patients/consultations
```

**Hospital Endpoints (Read-Only, limited to associated hospitals):**
```
GET    /hospitals/specialities?hospital_id={id}
GET    /hospitals/doctors?hospital_id={id}
```

**Search Endpoints:**
```
GET    /search/doctors?specialty_id={id}&hospital_id={id}
GET    /search/specialties?hospital_id={id}
```

### Sample Use Cases

```sql
-- Patient registers
POST /auth/register/patient
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+919876543210",
  "hospital_id": 1
}

-- Patient updates profile
PUT /patients/profile
{
  "first_name": "John",
  "last_name": "Doe Updated",
  "phone": "+919999999999"
}

-- Patient views specialties at their hospital
GET /hospitals/specialities?hospital_id=1
Response: [
  {
    "specialty_id": 1,
    "name": "Cardiology",
    "description": "Heart and cardiovascular diseases",
    "status": "active"
  }
]

-- Patient views doctors in a specialty
GET /search/doctors?specialty_id=1&hospital_id=1
Response: [
  {
    "user_id": 123,
    "username": "dr_smith",
    "email": "smith@hospital.com",
    "specialties": ["Cardiology"]
  }
]

-- Patient views own consultations
GET /patients/consultations
Response: {
  "consultations": [
    {
      "consultation_id": 10,
      "doctor_id": 123,
      "specialty_id": 1,
      "consultation_date": "2025-10-15T10:00:00",
      "status": "completed"
    }
  ]
}
```

### Important Notes

**Multi-Hospital Registration:**
```sql
-- Patient can be registered at multiple hospitals
INSERT INTO patient_hospitals (user_id, hospital_id, registered_on)
VALUES (456, 1, NOW());  -- Hospital 1

INSERT INTO patient_hospitals (user_id, hospital_id, registered_on)
VALUES (456, 2, NOW());  -- Hospital 2

-- Patient can only see doctors/specialties at hospitals they're registered at
SELECT s.* FROM specialties s
JOIN hospital_master h ON s.hospital_id = h.hospital_id  -- (if specialties are hospital-specific)
JOIN patient_hospitals ph ON h.hospital_id = ph.hospital_id
WHERE ph.user_id = 456 AND ph.is_active = 1;
```

**Consultation Flow:**
```sql
-- 1. Patient creates consultation (scheduled)
POST /consultations
{
  "doctor_id": 123,
  "specialty_id": 1,
  "hospital_id": 1,
  "consultation_date": "2025-10-20T14:00:00"
}

-- 2. Consultation happens (doctor starts session)
-- Patient participates via messages

-- 3. Consultation completes
UPDATE consultation SET status = 'completed' WHERE consultation_id = 10;

-- 4. Patient downloads transcript
GET /patients/consultations/10/transcript
Response: {
  "transcript_text": "Full consultation transcript...",
  "file_url": "https://storage.../transcript.pdf"
}
```

---

## 🔒 Permission Enforcement

### How Permissions Are Checked

```python
# Superadmin - Short-circuit (bypasses all checks)
@require_global_roles(role_names=["superadmin"], allow_super_admin=True)
async def endpoint(current_user: dict = Depends(...)):
    # If superadmin, immediately allowed
    pass

# Hospital Admin - Hospital role check
@require_hospital_roles(role_names=["hospital_admin"], hospital_id_param="hospital_id")
async def endpoint(current_user: dict = Depends(...)):
    # Checks user has hospital_admin role in specified hospital
    pass

# Doctor - Permission check
@require_permissions(["doctor.profile.view"], allow_super_admin=False)
async def endpoint(current_user: dict = Depends(...)):
    # Checks user has specific permission
    # Superadmin NOT allowed (allow_super_admin=False)
    pass

# Patient - Permission check with scope
@require_permissions(["patient.consultation.list"], allow_super_admin=False)
async def endpoint(current_user: dict = Depends(...)):
    # Checks user has specific permission
    # Additionally enforces patient can only see own consultations
    pass
```

### Permission Resolution Order

```
1. Check if user is superadmin → Allow immediately
2. Check Redis cache for user permissions → Return cached result
3. Query database:
   a. Direct user permissions (user_direct_permissions)
   b. Global role permissions (role_permission)
   c. Hospital role permissions (hospital_role_permission)
4. Merge all permissions
5. Cache in Redis (60s TTL)
6. Check if required permission is in user's permissions
7. Allow or Deny
```

---

## 📊 Permission Comparison Table

| Feature | Super Admin | Hospital Admin | Doctor | Patient |
|---------|-------------|----------------|--------|---------|
| **Scope** | Platform | Hospital | Hospital | Hospital |
| **Access Level** | All | Hospital-wide | Own data | Own data |
| **Create Hospital** | ✅ | ❌ | ❌ | ❌ |
| **Manage Users** | ✅ | ✅ (hospital) | ❌ | ❌ |
| **Create Roles** | ✅ | ✅ (hospital) | ❌ | ❌ |
| **Edit permission_master** | ✅ | ❌ | ❌ | ❌ |
| **Map Permissions to Roles** | ✅ | ✅ | ❌ | ❌ |
| **View All Patients** | ✅ | ✅ (hospital) | ❌ | ❌ |
| **View Own Patients** | ✅ | ✅ | ✅ | ❌ |
| **Update Own Profile** | ✅ | ✅ | ✅ | ✅ |
| **Create Consultation** | ✅ | ✅ | ✅ | ✅ |
| **View All Consultations** | ✅ | ✅ (hospital) | ❌ | ❌ |
| **View Own Consultations** | ✅ | ✅ | ✅ | ✅ |
| **Download Transcript** | ✅ | ✅ | ✅ | ✅ |
| **View Specialties** | ✅ | ✅ | ✅ | ✅ |
| **Create Specialties** | ✅ | ✅ | ❌ | ❌ |
| **Assign Specialties (self)** | ✅ | ✅ | ✅ | ❌ |
| **View Analytics** | ✅ | ✅ (hospital) | ✅ (self) | ❌ |
| **View Audit Logs** | ✅ | ❌ | ❌ | ❌ |

---

## 🔄 Role Assignment Examples

### 1. Create Superadmin (Seeded)
```sql
-- Typically seeded during initial setup
INSERT INTO role_master (role_id, role_name, role_scope, description)
VALUES (1, 'superadmin', 'platform', 'Platform super administrator');

INSERT INTO users (username, email, password_hash, global_role_id)
VALUES ('superadmin', 'admin@platform.com', '$2b$12$...', 1);
```

### 2. Create Hospital Admin (by Superadmin)
```sql
-- Superadmin onboards hospital with admin
POST /superadmin/onboard/hospital_admin
{
  "hospital_name": "Apollo Hospital",
  "hospital_email": "info@apollo.com",
  "admin_email": "admin@apollo.com",
  "admin_password": "SecurePass123!",
  "admin_username": "apollo_admin",
  "admin_first_name": "Hospital",
  "admin_last_name": "Administrator",
  "admin_phone": "+919876543210"
}

-- ⚡ Backend AUTOMATICALLY performs these actions:
-- 1. Creates hospital in hospital_master
-- 2. Creates 3 DEFAULT HOSPITAL ROLES:
--    a. hospital_admin (with full hospital permissions)
--    b. doctor (with doctor permissions)
--    c. patient (with patient permissions)
-- 3. Creates hospital admin user in users table (with all provided details)
-- 4. Creates user_details entry with first_name, last_name, phone
-- 5. Assigns hospital_admin role via hospital_user_roles
-- 6. Populates user_permissions table with hospital_admin permissions
```

### 3. Create Doctor (by Hospital Admin or Superadmin)
```sql
-- Hospital admin adds doctor
POST /hospital-admin/hospitals/1/users
{
  "role_name": "doctor",
  "email": "dr.smith@apollo.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Smith"
}

-- Backend:
-- 1. Creates user with global_role_id = 2 (doctor)
-- 2. Creates hospital_user_roles entry with hospital_role_id for "doctor"
-- 3. Populates user_permissions from hospital_role_permission
```

### 4. Register Patient (Self-Registration)
```sql
-- Patient self-registers
POST /auth/register/patient
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "hospital_id": 1
}

-- Backend:
-- 1. Creates user with global_role_id = 3 (patient)
-- 2. Creates patient_hospitals entry
-- 3. Creates hospital_user_roles entry with hospital_role_id for "patient"
-- 4. Populates user_permissions
```

---

## 🚨 Common Scenarios

### Scenario 1: Doctor Joins Second Hospital
```sql
-- Doctor (user_id: 123) already works at Hospital 1
-- Hospital 2 admin wants to add this doctor

-- Hospital 2 admin adds existing doctor
POST /hospital-admin/hospitals/2/users
{
  "role_name": "doctor",
  "email": "existing.doctor@hospital1.com",  // Existing email
  "password": "NewPassword123!"  // Will update if provided
}

-- Backend checks if user exists:
-- - If exists: Just add hospital_user_roles entry
-- - If not: Create new user then add association
```

### Scenario 2: Patient Consults at Multiple Hospitals
```sql
-- Patient registers at Hospital 1
POST /auth/register/patient
{
  "email": "patient@example.com",
  "password": "Pass123!",
  "hospital_id": 1
}

-- Later, patient visits Hospital 2
-- Hospital 2 receptionist registers patient
-- Backend links existing user to Hospital 2
INSERT INTO patient_hospitals (user_id, hospital_id)
VALUES (456, 2);

INSERT INTO hospital_user_roles (hospital_id, user_id, hospital_role_id)
VALUES (2, 456, [patient_role_id_at_hospital_2]);
```

### Scenario 3: Hospital Admin Creates Custom Role
```sql
-- Hospital admin creates "Nurse" role
POST /hospital-admin/hospitals/1/roles
{
  "role_name": "nurse",
  "description": "Nursing staff"
}

-- Hospital admin assigns permissions to nurse role
PUT /hospital-admin/hospitals/1/roles/10/permissions
{
  "permission_ids": [15, 16, 17, 18, 19, 20]
}

-- Permissions are from permission_master (read-only for hospital admin)
-- Hospital admin can only MAP existing permissions, not create new ones
```

---

## 💡 Key Takeaways

### 1. Superadmin
- **Complete access** to everything
- **Short-circuited** - bypasses permission checks
- **Platform-level** - not restricted to any hospital
- **Use case:** System administration, hospital onboarding

### 2. Hospital Admin
- **Hospital-wide access** within their hospital
- **Can create roles** but not permissions
- **Can map permissions** to roles
- **Cannot edit** permission_master table
- **Use case:** Hospital management, user management

### 3. Doctor
- **Own data access** only
- **Can view patients** they've consulted with
- **Can update** own profile and specialties
- **Use case:** Medical consultations, patient care

### 4. Patient
- **Self-service** access only
- **Can view** specialties and doctors at associated hospitals
- **Can consult** with doctors
- **Can download** own transcripts
- **Use case:** Healthcare consumer, consultation participant

---

## 📚 Related Documentation

- **[All 25 Tables Explained](ALL_25_TABLES_PURPOSE_AND_USAGE.md)** - Detailed table documentation
- **[Database Schema Reference](DATABASE_SCHEMA_AND_PERMISSIONS_REFERENCE.md)** - RBAC system details
- **[Complete Integration Guide](NEXTJS_BACKEND_INTEGRATION_COMPLETE_GUIDE.md)** - API endpoints
- **[Quick Start Guide](QUICK_START_INTEGRATION.md)** - Implementation examples

---

**Document Version:** 1.0  
**Last Updated:** October 20, 2025  
**Default Roles:** 4 (Superadmin, Hospital Admin, Doctor, Patient)

