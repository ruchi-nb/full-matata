# Database Schema & Permissions Reference

## 📊 Complete Database Schema

### Entity Relationship Diagram (Text)

```
┌─────────────────┐
│   RoleMaster    │
│   (Global)      │
└────────┬────────┘
         │
         │ global_role_id
         │
┌────────▼────────┐           ┌──────────────────┐
│     Users       │───────────│  UserDetails     │
│                 │  1:1      │  (Profile)       │
└────────┬────────┘           └──────────────────┘
         │
         │ Many-to-Many
         │
┌────────▼────────┐
│ HospitalMaster  │
│  (Tenant)       │
└────────┬────────┘
         │
         │ 1:Many
         │
┌────────▼────────┐           ┌──────────────────┐
│  HospitalRole   │───────────│ HospitalRole     │
│                 │           │  Permission      │
└────────┬────────┘           └────────┬─────────┘
         │                              │
         │ Many-to-Many                 │
         │ (via HospitalUserRoles)      │
         │                              │
         └──────────────┬───────────────┘
                        │
                ┌───────▼──────────┐
                │ PermissionMaster │
                └──────────────────┘
```

---

## 📁 Table Details

### 1. **users**
Primary user table for all users in the system.

| Column           | Type         | Description                           |
|------------------|--------------|---------------------------------------|
| user_id          | INT (PK)     | Primary key                           |
| username         | VARCHAR(150) | Unique username                       |
| email            | VARCHAR(255) | Unique email address                  |
| password_hash    | VARCHAR(255) | Bcrypt hashed password                |
| global_role_id   | INT (FK)     | FK to role_master                     |
| created_at       | DATETIME     | Record creation timestamp             |
| updated_at       | DATETIME     | Last update timestamp                 |

**Relationships:**
- `global_role_id` → `role_master.role_id`
- One-to-One with `user_details`
- Many-to-Many with `hospital_master` via `hospital_user_roles`

---

### 2. **role_master**
Global platform roles.

| Column           | Type         | Description                           |
|------------------|--------------|---------------------------------------|
| role_id          | INT (PK)     | Primary key                           |
| role_name        | VARCHAR(100) | Unique role name (e.g., 'superadmin') |
| role_scope       | VARCHAR(50)  | Always 'platform' for global roles    |
| parent_role_id   | INT (FK)     | FK to self (role hierarchy)           |
| description      | VARCHAR(500) | Role description                      |
| can_manage_roles | JSON         | Roles this role can manage            |
| created_at       | DATETIME     | Record creation timestamp             |
| updated_at       | DATETIME     | Last update timestamp                 |

**Default Roles:**
- `superadmin` (role_id: 1)
- `doctor` (role_id: 2)
- `patient` (role_id: 3)

**Relationships:**
- Self-referencing via `parent_role_id`
- One-to-Many with `users` via `global_role_id`

---

### 3. **hospital_master**
Multi-tenant hospital entities.

| Column           | Type         | Description                           |
|------------------|--------------|---------------------------------------|
| hospital_id      | INT (PK)     | Primary key                           |
| hospital_name    | VARCHAR(255) | Unique hospital name                  |
| hospital_email   | VARCHAR(255) | Hospital contact email                |
| admin_contact    | VARCHAR(255) | Admin phone/contact                   |
| address          | VARCHAR(1024)| Hospital address                      |
| created_at       | DATETIME     | Record creation timestamp             |
| updated_at       | DATETIME     | Last update timestamp                 |

**Relationships:**
- One-to-Many with `hospital_role`
- Many-to-Many with `users` via `hospital_user_roles`

---

### 4. **hospital_role**
Hospital-specific roles (tenant-level roles).

| Column                  | Type         | Description                           |
|-------------------------|--------------|---------------------------------------|
| hospital_role_id        | INT (PK)     | Primary key                           |
| hospital_id             | INT (FK)     | FK to hospital_master                 |
| role_name               | VARCHAR(150) | Role name (e.g., 'hospital_admin')    |
| description             | VARCHAR(500) | Role description                      |
| parent_hospital_role_id | INT (FK)     | FK to self (role hierarchy)           |
| is_active               | TINYINT(1)   | Active status (0 or 1)                |
| created_at              | DATETIME     | Record creation timestamp             |
| updated_at              | DATETIME     | Last update timestamp                 |

**Unique Constraint:** `(hospital_id, role_name)` - Role names must be unique per hospital

**Default Roles per Hospital:**
- `hospital_admin`
- `doctor`
- `nurse`
- `patient`

**Relationships:**
- Many-to-One with `hospital_master`
- Self-referencing via `parent_hospital_role_id`
- Many-to-Many with `permission_master` via `hospital_role_permission`

---

### 5. **permission_master**
All available permissions in the system.

| Column           | Type         | Description                           |
|------------------|--------------|---------------------------------------|
| permission_id    | INT (PK)     | Primary key                           |
| permission_name  | VARCHAR(150) | Unique permission name                |
| description      | VARCHAR(500) | Permission description                |
| created_at       | DATETIME     | Record creation timestamp             |
| updated_at       | DATETIME     | Last update timestamp                 |

**Naming Convention:** `{resource}.{action}` or `{resource}.{sub_resource}.{action}`

**Examples:**
- `hospital.profile.view`
- `hospital.profile.update`
- `hospital.doctor.create`
- `doctor.profile.view`
- `patient.consultation.list`

---

### 6. **role_permission**
Maps global roles to permissions.

| Column           | Type     | Description                           |
|------------------|----------|---------------------------------------|
| role_id          | INT (PK) | FK to role_master                     |
| permission_id    | INT (PK) | FK to permission_master               |
| created_at       | DATETIME | Record creation timestamp             |

**Primary Key:** `(role_id, permission_id)`

---

### 7. **hospital_role_permission**
Maps hospital roles to permissions.

| Column           | Type     | Description                           |
|------------------|----------|---------------------------------------|
| hospital_role_id | INT (PK) | FK to hospital_role                   |
| permission_id    | INT (PK) | FK to permission_master               |
| created_at       | DATETIME | Record creation timestamp             |

**Primary Key:** `(hospital_role_id, permission_id)`

---

### 8. **hospital_user_roles**
Association table linking users to hospitals with specific roles.

| Column           | Type        | Description                           |
|------------------|-------------|---------------------------------------|
| hospital_id      | INT (PK)    | FK to hospital_master                 |
| user_id          | INT (PK)    | FK to users                           |
| hospital_role_id | INT (PK)    | FK to hospital_role                   |
| assigned_on      | DATETIME    | Assignment timestamp                  |
| is_active        | TINYINT(1)  | Active status (0 or 1)                |

**Primary Key:** `(hospital_id, user_id, hospital_role_id)`

**Relationships:**
- Many-to-One with `hospital_master`
- Many-to-One with `users`
- Many-to-One with `hospital_role`

---

### 9. **user_permissions**
Cached/computed user permissions for fast access.

| Column                 | Type         | Description                                |
|------------------------|--------------|--------------------------------------------|
| user_permission_id     | INT (PK)     | Primary key                                |
| user_id                | INT (FK)     | FK to users                                |
| permission_id          | INT (FK)     | FK to permission_master                    |
| permission_name        | VARCHAR(150) | Cached permission name                     |
| scope                  | VARCHAR(50)  | 'global', 'hospital', or 'independent'     |
| hospital_id            | INT          | Hospital ID (if scope='hospital')          |
| hospital_id_coalesced  | INT          | Computed: coalesce(hospital_id, 0)         |
| granted_on             | DATETIME     | Permission grant timestamp                 |
| created_at             | DATETIME     | Record creation timestamp                  |

**Unique Constraint:** `(user_id, permission_id, hospital_id_coalesced, scope)`

**Purpose:** Fast permission lookup without complex joins. Populated automatically when:
- User is assigned a global role
- User is assigned a hospital role
- User is granted a direct permission

---

### 10. **user_details**
Extended user profile information.

| Column           | Type         | Description                           |
|------------------|--------------|---------------------------------------|
| user_id          | INT (PK)     | FK to users                           |
| first_name       | VARCHAR(120) | User first name                       |
| last_name        | VARCHAR(120) | User last name                        |
| dob              | DATE         | Date of birth                         |
| gender           | VARCHAR(32)  | Gender                                |
| phone            | VARCHAR(50)  | Phone number (validated for India)    |
| address          | TEXT         | Full address                          |

**Relationships:**
- One-to-One with `users`

---

### 11. **specialties**
Medical specialties available in the system.

| Column                    | Type         | Description                           |
|---------------------------|--------------|---------------------------------------|
| specialty_id              | INT (PK)     | Primary key                           |
| name                      | VARCHAR(200) | Unique specialty name                 |
| description               | TEXT         | Specialty description                 |
| status                    | VARCHAR(50)  | 'active' or 'inactive'                |
| default_training_template | JSON         | Default training config               |
| created_at                | DATETIME     | Record creation timestamp             |
| updated_at                | DATETIME     | Last update timestamp                 |

**Examples:**
- Cardiology
- Neurology
- Orthopedics
- Pediatrics

---

### 12. **doctor_specialties**
Maps doctors to their specialties.

| Column              | Type     | Description                           |
|---------------------|----------|---------------------------------------|
| doctor_specialty_id | INT (PK) | Primary key                           |
| user_id             | INT (FK) | FK to users (doctor)                  |
| specialty_id        | INT (FK) | FK to specialties                     |
| certified_date      | DATE     | Certification date                    |

**Unique Constraint:** `(user_id, specialty_id)`

---

### 13. **consultation**
Consultation records.

| Column              | Type         | Description                                |
|---------------------|--------------|--------------------------------------------|
| consultation_id     | INT (PK)     | Primary key                                |
| patient_id          | INT (FK)     | FK to users (patient)                      |
| doctor_id           | INT (FK)     | FK to users (doctor)                       |
| specialty_id        | INT (FK)     | FK to specialties                          |
| hospital_id         | INT (FK)     | FK to hospital_master (nullable)           |
| consultation_date   | DATETIME     | Consultation date/time                     |
| consultation_type   | VARCHAR(50)  | 'hospital' or 'independent'                |
| status              | VARCHAR(50)  | 'scheduled', 'ongoing', 'completed', etc.  |
| total_duration      | INT          | Duration in seconds                        |
| created_at          | DATETIME     | Record creation timestamp                  |
| updated_at          | DATETIME     | Last update timestamp                      |

**Relationships:**
- Many-to-One with `users` (as patient)
- Many-to-One with `users` (as doctor)
- Many-to-One with `specialties`
- Many-to-One with `hospital_master` (optional)

---

### 14. **consultation_sessions**
Individual consultation sessions within a consultation.

| Column              | Type         | Description                           |
|---------------------|--------------|---------------------------------------|
| session_id          | INT (PK)     | Primary key                           |
| consultation_id     | INT (FK)     | FK to consultation                    |
| session_start       | DATETIME     | Session start time                    |
| session_end         | DATETIME     | Session end time                      |
| session_type        | VARCHAR(50)  | 'text', 'voice', or 'video'           |
| total_tokens_used   | INT          | AI tokens consumed                    |
| total_api_calls     | INT          | Number of API calls                   |
| session_status      | VARCHAR(50)  | 'active', 'completed', 'interrupted'  |
| created_at          | DATETIME     | Record creation timestamp             |

---

### 15. **audit_logs**
Audit trail for all operations (READ-ONLY).

| Column           | Type         | Description                           |
|------------------|--------------|---------------------------------------|
| audit_id         | INT (PK)     | Primary key                           |
| event_type       | VARCHAR(255) | Event type (e.g., 'hospital.create')  |
| entity_type      | VARCHAR(50)  | Entity type (e.g., 'hospital')        |
| entity_id        | INT          | ID of affected entity                 |
| user_actor       | INT (FK)     | FK to users (who performed action)    |
| event_time       | DATETIME     | Event timestamp                       |
| old_values       | JSON         | Previous values                       |
| new_values       | JSON         | New values                            |
| user_agent       | TEXT         | User agent string                     |

**Purpose:** Complete audit trail for compliance and debugging.

---

## 🔐 Permission Mapping

### Superadmin Permissions

Superadmins have **all permissions** automatically via `allow_super_admin=True` bypass.

**Key Responsibilities:**
- Create and manage hospitals
- Create hospital admins
- View all data across all hospitals
- Assign global roles

---

### Hospital Admin Permissions

**Default Permissions:**
```
hospital.profile.view
hospital.profile.update
hospital.doctor.create
hospital.doctor.update
hospital.doctor.delete
hospital.doctors.list
hospital.patient.create
hospital.patient.update
hospital.patient.delete
hospital.patients.list
hospital.speciality.create
hospital.speciality.update
hospital.speciality.delete
hospital.specialities.list
hospital.role.create
hospital.role.update
hospital.role.assign
hospital.analytics.view
```

---

### Doctor Permissions

**Default Permissions:**
```
doctor.profile.view
doctor.profile.update
doctor.patients.list
doctor.patient.view
doctor.patient.consultations.list
doctor.consultation.create
doctor.consultation.view
doctor.consultation.update
doctor.analytics.patients
doctor.consultations.monthly
```

---

### Patient Permissions

**Default Permissions:**
```
patient.profile.view
patient.profile.update
patient.consultation.list
patient.consultation.view
patient.consultation.create
```

---

### Nurse Permissions (Example Custom Role)

**Example Permissions:**
```
hospital.patients.list
hospital.patient.view
hospital.consultation.view
hospital.consultation.update  // Can update vitals, notes
```

---

## 🔄 Permission Resolution Flow

When a user makes an API request:

1. **Token Decoded** → Extract `user_id` and `global_role`
2. **Super Admin Check** → If superadmin, allow immediately
3. **Permission Check** → Query `user_permissions` table
4. **Cache Lookup** → Check Redis cache for user permissions
5. **Database Query** (if cache miss):
   ```sql
   SELECT permission_name FROM (
     -- Direct user permissions
     SELECT permission_name FROM user_permissions WHERE user_id = ?
     
     UNION ALL
     
     -- Global role permissions
     SELECT p.permission_name 
     FROM permission_master p
     JOIN role_permission rp ON p.permission_id = rp.permission_id
     JOIN role_master rm ON rm.role_id = rp.role_id
     JOIN users u ON u.global_role_id = rm.role_id
     WHERE u.user_id = ?
     
     UNION ALL
     
     -- Hospital role permissions
     SELECT p.permission_name
     FROM permission_master p
     JOIN hospital_role_permission hrp ON p.permission_id = hrp.permission_id
     JOIN hospital_user_roles hur ON hur.hospital_role_id = hrp.hospital_role_id
     WHERE hur.user_id = ? AND hur.hospital_id = ?
   )
   ```
6. **Cache Result** → Store in Redis with 60s TTL
7. **Return Decision** → Allow or Deny

---

## 🧪 Sample Queries

### 1. Get User's Full Profile
```sql
SELECT 
  u.user_id,
  u.username,
  u.email,
  ud.first_name,
  ud.last_name,
  ud.phone,
  ud.address,
  rm.role_name AS global_role
FROM users u
LEFT JOIN user_details ud ON u.user_id = ud.user_id
LEFT JOIN role_master rm ON u.global_role_id = rm.role_id
WHERE u.user_id = ?;
```

### 2. Get User's Hospital Roles
```sql
SELECT 
  h.hospital_name,
  hr.role_name,
  hur.is_active,
  hur.assigned_on
FROM hospital_user_roles hur
JOIN hospital_master h ON hur.hospital_id = h.hospital_id
JOIN hospital_role hr ON hur.hospital_role_id = hr.hospital_role_id
WHERE hur.user_id = ?;
```

### 3. Get All Permissions for a User in a Hospital
```sql
SELECT DISTINCT p.permission_name
FROM permission_master p
WHERE p.permission_id IN (
  -- Hospital role permissions
  SELECT hrp.permission_id
  FROM hospital_role_permission hrp
  JOIN hospital_user_roles hur ON hur.hospital_role_id = hrp.hospital_role_id
  WHERE hur.user_id = ? AND hur.hospital_id = ?
  
  UNION
  
  -- Direct user permissions
  SELECT up.permission_id
  FROM user_permissions up
  WHERE up.user_id = ? AND (up.hospital_id = ? OR up.scope = 'global')
);
```

### 4. Get All Doctors in a Hospital
```sql
SELECT 
  u.user_id,
  u.username,
  u.email,
  ud.first_name,
  ud.last_name
FROM users u
JOIN hospital_user_roles hur ON u.user_id = hur.user_id
JOIN hospital_role hr ON hur.hospital_role_id = hr.hospital_role_id
LEFT JOIN user_details ud ON u.user_id = ud.user_id
WHERE hur.hospital_id = ? 
  AND hr.role_name = 'doctor'
  AND hur.is_active = 1;
```

### 5. Get Consultation History for a Patient
```sql
SELECT 
  c.consultation_id,
  c.consultation_date,
  c.status,
  doc.username AS doctor_name,
  s.name AS specialty_name,
  h.hospital_name
FROM consultation c
JOIN users doc ON c.doctor_id = doc.user_id
JOIN specialties s ON c.specialty_id = s.specialty_id
LEFT JOIN hospital_master h ON c.hospital_id = h.hospital_id
WHERE c.patient_id = ?
ORDER BY c.consultation_date DESC;
```

---

## 📝 Data Seeding

### Required Master Data

#### 1. **Global Roles**
```sql
INSERT INTO role_master (role_name, role_scope, description) VALUES
('superadmin', 'platform', 'Platform super administrator'),
('doctor', 'platform', 'Medical doctor'),
('patient', 'platform', 'Patient user');
```

#### 2. **Common Permissions**
```sql
INSERT INTO permission_master (permission_name, description) VALUES
-- Hospital permissions
('hospital.profile.view', 'View hospital profile'),
('hospital.profile.update', 'Update hospital profile'),
('hospital.doctor.create', 'Add doctor to hospital'),
('hospital.doctors.list', 'List all doctors in hospital'),
('hospital.patient.create', 'Add patient to hospital'),
('hospital.patients.list', 'List all patients in hospital'),
('hospital.speciality.create', 'Create specialty'),
('hospital.specialities.list', 'List specialties'),

-- Doctor permissions
('doctor.profile.view', 'View own doctor profile'),
('doctor.profile.update', 'Update own doctor profile'),
('doctor.patients.list', 'List own patients'),
('doctor.patient.view', 'View patient details'),
('doctor.consultation.create', 'Create consultation'),

-- Patient permissions
('patient.profile.view', 'View own patient profile'),
('patient.profile.update', 'Update own patient profile'),
('patient.consultation.list', 'List own consultations'),
('patient.consultation.view', 'View own consultation details');
```

#### 3. **Common Specialties**
```sql
INSERT INTO specialties (name, description, status) VALUES
('Cardiology', 'Heart and cardiovascular system', 'active'),
('Neurology', 'Brain and nervous system', 'active'),
('Orthopedics', 'Bones and joints', 'active'),
('Pediatrics', 'Children\'s health', 'active'),
('Dermatology', 'Skin conditions', 'active');
```

---

## 🔧 Database Indexes

**Existing Indexes** (based on models.py):

```sql
-- Users table
CREATE UNIQUE INDEX email ON users(email);
CREATE UNIQUE INDEX username ON users(username);
CREATE INDEX idx_users_globalrole ON users(global_role_id);

-- Hospital Master
CREATE UNIQUE INDEX hospital_name ON hospital_master(hospital_name);

-- Role Master
CREATE UNIQUE INDEX role_name ON role_master(role_name);
CREATE INDEX parent_role_id ON role_master(parent_role_id);

-- Permission Master
CREATE UNIQUE INDEX permission_name ON permission_master(permission_name);

-- Hospital Role
CREATE UNIQUE INDEX uq_hospital_role ON hospital_role(hospital_id, role_name);
CREATE INDEX idx_hr_hospital ON hospital_role(hospital_id);

-- Hospital User Roles
CREATE INDEX idx_hur_user ON hospital_user_roles(user_id);
CREATE INDEX idx_hur_role ON hospital_user_roles(hospital_role_id);

-- User Permissions
CREATE UNIQUE INDEX uq_user_perm ON user_permissions(user_id, permission_id, hospital_id_coalesced, scope);
CREATE INDEX idx_up_user ON user_permissions(user_id);
CREATE INDEX idx_up_permission ON user_permissions(permission_id);
CREATE INDEX idx_up_hospital ON user_permissions(hospital_id);

-- Consultation
CREATE INDEX idx_consult_patient_date ON consultation(patient_id, consultation_date);
CREATE INDEX idx_consult_doctor_date ON consultation(doctor_id, consultation_date);

-- Audit Logs
CREATE INDEX idx_user_actor ON audit_logs(user_actor);
CREATE INDEX idx_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_event_time ON audit_logs(event_time);
```

---

## 🚀 Performance Optimization

### Redis Caching Strategy

**Permission Cache:**
- **Key:** `user:{user_id}:hospital:{hospital_id}:perms`
- **Value:** JSON array of permission names
- **TTL:** 60 seconds

**Permission Check Cache:**
- **Key:** `permcheck:user:{user_id}:hospital:{hospital_id}:{permission1,permission2}`
- **Value:** `{"allowed": true/false, "missing": [...]}`
- **TTL:** 60 seconds

**Cache Invalidation:**
- When user role changes
- When role permissions are modified
- When hospital role permissions change

---

## 🎯 Best Practices

### 1. **Always Use Transactions**
When creating users, assign roles within the same transaction:

```python
async with db.begin():
    user = Users(...)
    db.add(user)
    await db.flush()  # Get user_id
    
    hur = HospitalUserRoles(user_id=user.user_id, ...)
    db.add(hur)
    
    # Both committed together
```

### 2. **Permission Naming**
Follow consistent naming:
- `{resource}.{action}` → `hospital.view`
- `{resource}.{sub_resource}.{action}` → `hospital.doctor.create`

### 3. **Audit Everything**
Log all critical operations to `audit_logs`:
```python
await create_audit_log(
    db,
    event_type="hospital.create",
    entity_type="hospital",
    entity_id=hospital_id,
    user_actor=current_user.user_id,
    new_values={"hospital_name": "..."}
)
```

### 4. **Soft Deletes**
Use `is_active` flags instead of hard deletes where appropriate.

---

## 📚 Additional Resources

- **SQLAlchemy ORM Models**: `/backend/models/models.py`
- **Pydantic Schemas**: `/backend/schema/schema.py`
- **Database Migrations**: Use Alembic for schema changes
- **Backup Strategy**: Regular MySQL backups + transaction logs

---

**Document Version**: 1.0  
**Last Updated**: October 20, 2025

