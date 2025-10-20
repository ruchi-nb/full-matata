# Important Automatic Processes - Remember These!

## 🚨 Critical System Behaviors

This document outlines the **automatic processes** that happen behind the scenes in your system. These are crucial to understand for proper system operation and integration.

---

## 1. 🏥 Hospital Creation Process (Superadmin Action)

### What Happens When Superadmin Creates a Hospital

**Endpoint:** `POST /superadmin/onboard/hospital_admin`

**Input:**
```json
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
```

### ⚡ Automatic Actions (All Happen in Single Transaction)

#### Step 1: Create Hospital
```sql
INSERT INTO hospital_master (hospital_name, hospital_email, admin_contact, address)
VALUES ('Apollo Hospital', 'info@apollo.com', '+919876543210', NULL);
-- Returns: hospital_id = 1
```

#### Step 2: Auto-Create 3 DEFAULT Hospital Roles

**IMPORTANT:** Every new hospital automatically gets these 3 roles:

```sql
-- Role 1: Hospital Admin
INSERT INTO hospital_role (hospital_id, role_name, description, is_active)
VALUES (1, 'hospital_admin', 'Hospital administrator with full hospital access', 1);
-- Returns: hospital_role_id = 1

-- Role 2: Doctor
INSERT INTO hospital_role (hospital_id, role_name, description, is_active)
VALUES (1, 'doctor', 'Medical doctor practicing at this hospital', 1);
-- Returns: hospital_role_id = 2

-- Role 3: Patient
INSERT INTO hospital_role (hospital_id, role_name, description, is_active)
VALUES (1, 'patient', 'Patient registered at this hospital', 1);
-- Returns: hospital_role_id = 3
```

#### Step 3: Auto-Create Hospital Admin User (WITH ALL DETAILS)

```sql
-- Create user account
INSERT INTO users (username, email, password_hash, global_role_id)
VALUES ('apollo_admin', 'admin@apollo.com', '$2b$12$...', 2);  -- global_role_id = 2 (doctor global role, but will have hospital_admin tenant role)
-- Returns: user_id = 10

-- Create user details (AUTOMATICALLY)
INSERT INTO user_details (user_id, first_name, last_name, phone)
VALUES (10, 'Hospital', 'Administrator', '+919876543210');

-- Create user settings (AUTOMATICALLY)
INSERT INTO user_settings (user_id, notification_email, notification_sms, language_preference)
VALUES (10, 1, 0, 'en');
```

#### Step 4: Assign Hospital Admin Role to User

```sql
-- Link user to hospital with hospital_admin role
INSERT INTO hospital_user_roles (hospital_id, user_id, hospital_role_id, is_active)
VALUES (1, 10, 1, 1);  -- hospital_role_id = 1 is 'hospital_admin'
```

#### Step 5: Copy Default Permissions to Hospital Roles

```sql
-- Copy permissions from global 'doctor' role to hospital 'hospital_admin' role
INSERT INTO hospital_role_permission (hospital_role_id, permission_id)
SELECT 1, permission_id FROM role_permission WHERE role_id = 2;  -- Copy doctor permissions

-- Additional hospital_admin specific permissions
INSERT INTO hospital_role_permission (hospital_role_id, permission_id)
SELECT 1, permission_id FROM permission_master 
WHERE permission_name IN (
  'hospital.profile.view',
  'hospital.profile.update',
  'hospital.user.create',
  'hospital.role.create',
  'hospital.doctor.create',
  'hospital.patient.create'
  -- ... more hospital admin permissions
);

-- Copy permissions to hospital 'doctor' role
INSERT INTO hospital_role_permission (hospital_role_id, permission_id)
SELECT 2, permission_id FROM role_permission WHERE role_id = 2;  -- Copy doctor permissions

-- Copy permissions to hospital 'patient' role
INSERT INTO hospital_role_permission (hospital_role_id, permission_id)
SELECT 3, permission_id FROM role_permission WHERE role_id = 3;  -- Copy patient permissions
```

#### Step 6: Populate User Permissions Cache

```sql
-- Auto-populate user_permissions table for fast lookups
INSERT INTO user_permissions (user_id, permission_id, permission_name, scope, hospital_id)
SELECT 
  10,  -- user_id
  hrp.permission_id,
  pm.permission_name,
  'hospital',
  1  -- hospital_id
FROM hospital_role_permission hrp
JOIN permission_master pm ON hrp.permission_id = pm.permission_id
WHERE hrp.hospital_role_id = 1;  -- hospital_admin role
```

#### Step 7: Create Audit Log

```sql
INSERT INTO audit_logs (event_type, entity_type, entity_id, user_actor, new_values)
VALUES (
  'hospital.create',
  'hospital',
  1,  -- hospital_id
  1,  -- superadmin user_id
  '{"hospital_name": "Apollo Hospital", "admin_email": "admin@apollo.com"}'
);
```

### 🎯 Summary of Automatic Actions

When superadmin creates a hospital:

✅ **1 Hospital** is created
✅ **3 Default Roles** are auto-created:
   - `hospital_admin` (full hospital access)
   - `doctor` (doctor permissions)
   - `patient` (patient permissions)
✅ **1 Hospital Admin User** is created with ALL provided details:
   - Username
   - Email
   - Password (hashed)
   - First name
   - Last name
   - Phone
✅ **Permissions** are auto-copied from global roles to hospital roles
✅ **User-Role Assignment** is automatic
✅ **User Permissions Cache** is populated
✅ **Audit Log** is created

**Total Operations:** ~50+ SQL statements in a single transaction!

---

## 2. 🏥 The 3 Default Hospital Roles

### IMPORTANT: Every Hospital Has These 3 Roles

When a hospital is added to the database, it **AUTOMATICALLY** gets these 3 roles:

### Role 1: `hospital_admin`
**Purpose:** Full hospital management
- **Table:** `hospital_role`
- **role_name:** `'hospital_admin'`
- **Unique per hospital:** Yes (hospital_id + role_name)
- **Permissions:** Full hospital access (copied from predefined list)

**Key Capabilities:**
- Create users (doctors, patients, staff)
- Create custom roles
- Assign permissions to roles (from permission_master)
- Manage hospital profile
- View analytics

**Cannot Do:**
- Edit `permission_master` table
- Access other hospitals' data

### Role 2: `doctor`
**Purpose:** Medical professionals
- **Table:** `hospital_role`
- **role_name:** `'doctor'`
- **Unique per hospital:** Yes
- **Permissions:** Doctor-specific (copied from global doctor role)

**Key Capabilities:**
- View own patients
- Create consultations
- Update own profile
- View transcripts

**Cannot Do:**
- View other doctors' patients
- Create users or roles

### Role 3: `patient`
**Purpose:** Healthcare consumers
- **Table:** `hospital_role`
- **role_name:** `'patient'`
- **Unique per hospital:** Yes
- **Permissions:** Patient-specific (copied from global patient role)

**Key Capabilities:**
- View specialties
- View doctors
- Consult with doctors
- Download own transcripts

**Cannot Do:**
- View other patients' data
- Create consultations for others

---

## 3. 📋 Complete Onboarding Flow

### Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Superadmin calls POST /superadmin/onboard/hospital_admin   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Create Hospital in hospital_master                 │
│  Result: hospital_id = X                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Auto-Create 3 Default Hospital Roles               │
│  • hospital_admin (hospital_role_id = A)                    │
│  • doctor (hospital_role_id = B)                            │
│  • patient (hospital_role_id = C)                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Copy Permissions to Hospital Roles                 │
│  • Map permissions to hospital_admin role                   │
│  • Map permissions to doctor role                           │
│  • Map permissions to patient role                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Create Hospital Admin User                         │
│  • Insert into users (username, email, password_hash)       │
│  • Insert into user_details (first_name, last_name, phone)  │
│  • Insert into user_settings (defaults)                     │
│  Result: user_id = Y                                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Assign Hospital Admin Role to User                 │
│  • Insert into hospital_user_roles                          │
│    (hospital_id=X, user_id=Y, hospital_role_id=A)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: Populate User Permissions Cache                    │
│  • Insert into user_permissions                             │
│    (all hospital_admin permissions for quick lookup)        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 7: Create Audit Log                                   │
│  • Log hospital creation event                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  SUCCESS: Hospital + Admin + 3 Roles Ready!                 │
│  Response: { hospital_id, admin_user_id, access_token? }    │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 🔐 Default Role Permissions

### What Permissions Are Auto-Assigned?

#### Hospital Admin Role (`hospital_admin`)
When created, this role automatically gets these permissions:

```sql
-- Hospital Management
'hospital.profile.view'
'hospital.profile.update'
'hospital.analytics.view'

-- User Management
'hospital.user.create'
'hospital.user.view'
'hospital.user.update'
'hospital.user.delete'
'hospital.users.list'

-- Doctor Management
'hospital.doctor.create'
'hospital.doctor.update'
'hospital.doctor.delete'
'hospital.doctors.list'
'hospital.doctor.specialty.assign'

-- Patient Management
'hospital.patient.create'
'hospital.patient.update'
'hospital.patient.delete'
'hospital.patients.list'

-- Role Management
'hospital.role.create'
'hospital.role.update'
'hospital.role.delete'
'hospital.roles.list'
'hospital.role.permission.assign'
'hospital.role.permission.view'

-- Permission Viewing (Read-Only)
'hospital.permission.list'
'hospital.permission.view'

-- Specialty Management
'hospital.speciality.create'
'hospital.speciality.update'
'hospital.speciality.delete'
'hospital.specialities.list'
```

#### Doctor Role (`doctor`)
Auto-assigned permissions:

```sql
-- Profile (Self)
'doctor.profile.view'
'doctor.profile.update'
'doctor.specialties.view'
'doctor.specialties.update'

-- Patients (Own)
'doctor.patients.list'
'doctor.patient.view'
'doctor.patient.consultations.list'

-- Consultations (Own)
'doctor.consultation.create'
'doctor.consultation.view'
'doctor.consultation.update'
'doctor.consultation.transcript.view'

-- Analytics (Self)
'doctor.analytics.patients'
'doctor.consultations.monthly'
```

#### Patient Role (`patient`)
Auto-assigned permissions:

```sql
-- Profile (Self)
'patient.profile.view'
'patient.profile.update'
'patient.settings.view'
'patient.settings.update'

-- Consultations (Own)
'patient.consultation.create'
'patient.consultation.view'
'patient.consultation.list'
'patient.consultation.transcript.view'
'patient.consultation.transcript.download'

-- Hospital Information (Read-Only)
'hospital.specialities.list'
'hospital.doctors.list'
'hospital.doctor.view'
```

---

## 5. 🎯 Key Takeaways - REMEMBER THESE!

### ✅ Hospital Creation by Superadmin

1. **ONE API CALL** → Multiple automatic actions
2. **Hospital admin user created WITH ALL DETAILS**:
   - Username
   - Email
   - Password (hashed)
   - First name
   - Last name
   - Phone number
3. **3 DEFAULT ROLES ALWAYS CREATED**:
   - `hospital_admin`
   - `doctor`
   - `patient`
4. **Permissions AUTO-COPIED** from global roles
5. **User-role assignment AUTOMATIC**
6. **Everything happens in ONE TRANSACTION** (all or nothing)

### ✅ Hospital Roles

1. **Every hospital has EXACTLY 3 default roles**
2. **Role names are CONSISTENT** across all hospitals:
   - `hospital_admin` (same name everywhere)
   - `doctor` (same name everywhere)
   - `patient` (same name everywhere)
3. **Roles are UNIQUE per hospital**:
   - Hospital A has its own `doctor` role
   - Hospital B has its own `doctor` role
   - They can have different permissions!

### ✅ Hospital Admin User

1. **Automatically created with FULL DETAILS**
2. **Has `hospital_admin` role** in their hospital
3. **Can immediately login** and manage hospital
4. **Has ALL hospital management permissions**

### ✅ Permissions

1. **permission_master is READ-ONLY** for hospital admins
2. **Hospital admin CAN**:
   - View all permissions
   - Map existing permissions to roles
3. **Hospital admin CANNOT**:
   - Create new permissions
   - Modify permission definitions
   - Delete permissions

---

## 6. 💡 Common Questions

### Q: Can I create a hospital without a hospital admin?
**A:** No. Hospital creation ALWAYS creates a hospital admin user. This is by design to ensure every hospital has someone who can manage it.

### Q: Can I add more default roles to new hospitals?
**A:** You can modify the backend code to add more default roles, but the 3 default roles (hospital_admin, doctor, patient) are standard for all hospitals.

### Q: What if I want different permissions for doctor role in different hospitals?
**A:** This is supported! Each hospital's `doctor` role can have different permissions. Hospital admin can modify role permissions within their hospital.

### Q: Can hospital admin create new roles?
**A:** Yes! Hospital admin can create custom roles like "nurse", "receptionist", "lab_technician", etc. But they must use existing permissions from `permission_master`.

### Q: Can I delete the 3 default roles?
**A:** Technically possible but NOT RECOMMENDED. These roles are expected by the system. You can deactivate them (`is_active = 0`) but keep them in the database.

### Q: What happens if hospital admin user is deleted?
**A:** You can delete the user, but you should create another hospital admin first. Otherwise, the hospital will have no administrator.

---

## 7. 📝 Backend Code Reference

### Service Function: `create_hospital_with_admin`
**File:** `backend/service/superadmin_service.py`

This function handles the entire hospital onboarding process:

```python
async def create_hospital_with_admin(
    db: AsyncSession,
    payload: OnboardHospitalAdminIn,
    actor_user: dict
) -> OnboardHospitalAdminOut:
    """
    Creates:
    1. Hospital in hospital_master
    2. 3 default hospital roles (hospital_admin, doctor, patient)
    3. Hospital admin user with ALL details
    4. User-role assignment
    5. Permission mappings
    6. User permissions cache
    7. Audit log
    """
    # All operations in one transaction
    async with db.begin():
        # Step 1: Create hospital
        # Step 2: Create 3 default roles
        # Step 3: Map permissions to roles
        # Step 4: Create admin user (with details)
        # Step 5: Assign hospital_admin role
        # Step 6: Populate user_permissions
        # Step 7: Create audit log
```

---

## 8. 🧪 Testing the Automatic Process

### Test Case 1: Create Hospital and Verify All Automatic Actions

```bash
# 1. Create hospital (as superadmin)
curl -X POST http://localhost:8000/superadmin/onboard/hospital_admin \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "hospital_name": "Test Hospital",
    "hospital_email": "test@hospital.com",
    "admin_email": "admin@test.com",
    "admin_password": "SecurePass123!",
    "admin_username": "test_admin",
    "admin_first_name": "Test",
    "admin_last_name": "Admin",
    "admin_phone": "+919876543210"
  }'

# 2. Verify hospital created
SELECT * FROM hospital_master WHERE hospital_name = 'Test Hospital';

# 3. Verify 3 default roles created
SELECT * FROM hospital_role WHERE hospital_id = [new_hospital_id];
-- Expected: 3 rows (hospital_admin, doctor, patient)

# 4. Verify admin user created with details
SELECT u.*, ud.* FROM users u
LEFT JOIN user_details ud ON u.user_id = ud.user_id
WHERE u.email = 'admin@test.com';
-- Expected: user with first_name='Test', last_name='Admin', phone='+919876543210'

# 5. Verify role assignment
SELECT * FROM hospital_user_roles 
WHERE user_id = [new_user_id] AND hospital_id = [new_hospital_id];
-- Expected: 1 row with hospital_admin role

# 6. Verify permissions cached
SELECT COUNT(*) FROM user_permissions 
WHERE user_id = [new_user_id] AND hospital_id = [new_hospital_id];
-- Expected: 30+ permissions
```

---

## 🎯 Final Reminder

### The 4 Default System Roles

1. **Superadmin** (Platform Level)
   - Scope: Platform-wide
   - Created: Seeded in database
   - Short-circuited: Yes (bypasses all checks)

2. **Hospital Admin** (Tenant Level)
   - Scope: Hospital-specific
   - Created: Auto-created when hospital is onboarded
   - Can create roles: Yes
   - Can edit permission_master: No

3. **Doctor** (Tenant Level)
   - Scope: Hospital-specific
   - Created: Auto-created as default hospital role
   - Access: Own patients and consultations only

4. **Patient** (Tenant Level)
   - Scope: Hospital-specific
   - Created: Auto-created as default hospital role
   - Access: Own data and consultations only

### The Automatic Process

✅ Superadmin creates hospital → Hospital admin user auto-created WITH ALL DETAILS
✅ Hospital created → 3 default roles auto-created (hospital_admin, doctor, patient)
✅ Roles created → Permissions auto-assigned from global roles
✅ Everything in ONE TRANSACTION → All or nothing

---

**Remember:** This is the foundation of your multi-tenant RBAC system!

**Document Version:** 1.0  
**Last Updated:** October 20, 2025

