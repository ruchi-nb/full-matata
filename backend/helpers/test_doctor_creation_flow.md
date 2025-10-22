# Test Doctor Creation Flow

## Overview
This document outlines the complete flow when a hospital admin creates a doctor with a specialty.

## Database Tables Involved

### 1. **users** (Global)
- Stores basic user authentication info
- Fields: `user_id`, `username`, `email`, `password_hash`, `role_id` (global role)

### 2. **user_details** (Global)
- Stores user profile information
- Fields: `user_id`, `first_name`, `last_name`, `phone`, `gender`, `dob`, `address`

### 3. **specialties** (Global)
- Master list of all medical specialties
- Fields: `specialty_id`, `name`, `description`, `status`

### 4. **doctor_specialties** (Global)
- Links doctors to their specialties
- Fields: `doctor_specialty_id`, `user_id`, `specialty_id`, `certified_date`

### 5. **hospital_specialties** (Tenant)
- Links hospitals to specialties they offer
- Fields: `id`, `hospital_id`, `specialty_id`, `is_primary`

### 6. **doctor_hospitals** (Tenant)
- Links doctors to hospitals they work at
- Fields: `user_id`, `hospital_id`

### 7. **hospital_role** (Tenant)
- Defines roles within a hospital
- Fields: `hospital_role_id`, `hospital_id`, `role_name`, `description`

### 8. **hospital_user_roles** (Tenant)
- Links users to their roles in a hospital
- Fields: `id`, `user_id`, `hospital_id`, `hospital_role_id`, `is_active`

## Expected Flow When Creating a Doctor

### Frontend (`DoctorForm.jsx`)
1. User fills form with:
   - Email
   - Role: "doctor"
   - Specialty: "hakuna matata" (selected from dropdown)
   - Password
   - Optional: first_name, last_name, phone

2. Frontend sends POST to `/hospital-admin/hospitals/{hospital_id}/users`:
```json
{
  "email": "test_hakuna@example.com",
  "role_name": "doctor",
  "username": "test_hakuna",
  "password": "Test@1234",
  "specialty": "hakuna matata"
}
```

### Backend (`hospital_admin_routers.py`)
3. Endpoint validates payload against `HospitalAdminCreateUserIn` schema
4. Calls `hospital_admin_create_user()` service function

### Backend Service (`hospital_admin_service.py`)
5. **Create User** (lines 90-193):
   - Validates hospital exists
   - Checks for duplicate email/username
   - Gets/creates tenant role in `hospital_role` table
   - Maps tenant role to global role (doctor → role_id=2)
   - Creates user in `users` table
   - Creates user details in `user_details` table
   - Links user to hospital role in `hospital_user_roles` table

6. **Handle Specialty** (lines 199-257):
   - Checks if role is "doctor" AND specialty is provided
   - **LOGS:** `🔍 Checking specialty assignment: role_name='doctor', specialty='hakuna matata'`
   - **LOGS:** `✅ ENTERING specialty assignment block`
   
   **Step 6a: Ensure specialty exists in `specialties` table**
   - Query `specialties` for matching name
   - If not found, **auto-create** new specialty:
     ```python
     specialty_obj = Specialties(
         name=specialty,
         description=f"Specialty created automatically when adding doctor",
         status='active'
     )
     ```
   - **LOGS:** `✅ Created new specialty 'hakuna matata' (ID: X)`
   
   **Step 6b: Link doctor to specialty in `doctor_specialties` table**
   ```python
   doctor_specialty = DoctorSpecialties(
       user_id=user.user_id,
       specialty_id=specialty_obj.specialty_id
   )
   ```
   - **LOGS:** `✅ Assigned specialty 'hakuna matata' (ID: X) to doctor Y`
   
   **Step 6c: Link hospital to specialty in `hospital_specialties` table**
   - Check if hospital already has this specialty
   - If not, create new entry:
     ```python
     hospital_specialty = HospitalSpecialties(
         hospital_id=hospital_id,
         specialty_id=specialty_obj.specialty_id,
         is_primary=0
     )
     ```
   - **LOGS:** `✅ Added specialty 'hakuna matata' to hospital_specialties for hospital_id=Z`

7. **Link Doctor to Hospital** (lines 261-276):
   - Insert into `doctor_hospitals` junction table:
     ```python
     stmt = insert(t_doctor_hospitals).values(
         user_id=user.user_id,
         hospital_id=hospital_id
     )
     ```
   - **LOGS:** `✅ Associated doctor user_id=Y with hospital_id=Z in doctor_hospitals table`

8. **Commit Transaction** (line 295)

## Expected Database State After Creating Doctor

### Example: Creating doctor "test_hakuna@example.com" with specialty "hakuna matata" in hospital 9

```sql
-- 1. User created
SELECT user_id, username, email, role_id FROM users WHERE email = 'test_hakuna@example.com';
-- Expected: user_id=40, role_id=2 (doctor global role)

-- 2. User details created (if first_name, last_name, phone provided)
SELECT * FROM user_details WHERE user_id = 40;

-- 3. Specialty created (if it didn't exist)
SELECT * FROM specialties WHERE name = 'hakuna matata';
-- Expected: specialty_id=19, name='hakuna matata', status='active'

-- 4. Doctor-specialty link created
SELECT * FROM doctor_specialties WHERE user_id = 40;
-- Expected: user_id=40, specialty_id=19

-- 5. Hospital-specialty link created
SELECT * FROM hospital_specialties WHERE hospital_id = 9 AND specialty_id = 19;
-- Expected: hospital_id=9, specialty_id=19, is_primary=0

-- 6. Doctor-hospital link created
SELECT * FROM doctor_hospitals WHERE user_id = 40;
-- Expected: user_id=40, hospital_id=9

-- 7. Hospital role assignment
SELECT * FROM hospital_user_roles WHERE user_id = 40;
-- Expected: user_id=40, hospital_id=9, hospital_role_id=2 (tenant doctor role)
```

## Verification Queries

### Check if patients can see the specialty
```sql
SELECT s.specialty_id, s.name, s.description, s.status
FROM patient_hospitals ph
JOIN hospital_specialties hs ON hs.hospital_id = ph.hospital_id
JOIN specialties s ON s.specialty_id = hs.specialty_id
WHERE ph.user_id = 39  -- patient user_id
  AND ph.is_active = 1
  AND s.status = 'active';
```

### Check all doctors with a specific specialty in a hospital
```sql
SELECT u.user_id, u.email, s.name as specialty
FROM users u
JOIN doctor_specialties ds ON ds.user_id = u.user_id
JOIN specialties s ON s.specialty_id = ds.specialty_id
JOIN doctor_hospitals dh ON dh.user_id = u.user_id
WHERE dh.hospital_id = 9
  AND s.name = 'hakuna matata';
```

## Common Issues

### Issue 1: `doctor_specialties` not updating
**Symptom:** Doctor created successfully, but no entry in `doctor_specialties` table

**Causes:**
1. ❌ Frontend not sending `specialty` field
2. ❌ Backend schema not accepting `specialty` field
3. ❌ Backend service not receiving `specialty` in payload
4. ❌ Exception in specialty assignment block (silently caught)

**Fix:** Check backend logs for these messages:
- `🔍 Checking specialty assignment: role_name='doctor', specialty='hakuna matata'`
- `✅ ENTERING specialty assignment block`
- `✅ Assigned specialty 'hakuna matata' to doctor`

If you don't see these logs, the specialty field is not reaching the service.

### Issue 2: `hospital_specialties` not updating
**Symptom:** `doctor_specialties` has entry, but `hospital_specialties` doesn't

**Causes:**
1. ❌ Exception when inserting into `hospital_specialties`
2. ❌ Transaction rollback

**Fix:** Check backend logs for:
- `✅ Added specialty 'hakuna matata' to hospital_specialties for hospital_id=Z`
- `❌ Failed to assign specialty to doctor: [error message]`

### Issue 3: Patients can't see specialty
**Symptom:** Doctor created with specialty, but patient portal shows empty

**Root Causes:**
1. ❌ Patient not linked to hospital in `patient_hospitals` table
2. ❌ Hospital not linked to specialty in `hospital_specialties` table
3. ❌ Specialty status is 'inactive' in `specialties` table

**Fix:** Run verification query above to check the complete chain.

## Testing Checklist

- [ ] Add `specialty` field to `HospitalAdminCreateUserIn` schema ✅
- [ ] Frontend sends `specialty` in payload
- [ ] Backend receives `specialty` in payload
- [ ] Specialty auto-created in `specialties` table if not exists
- [ ] Entry created in `doctor_specialties` table
- [ ] Entry created in `hospital_specialties` table
- [ ] Entry created in `doctor_hospitals` table
- [ ] Patient can see specialty in patient portal
- [ ] All backend logs appear correctly

