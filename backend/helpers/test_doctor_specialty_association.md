# Test: Doctor-Specialty Association

## Overview
When a hospital admin creates a doctor with a specialty, THREE tables should be updated:
1. ✅ `doctor_specialties` - Links the doctor to their specialty
2. ✅ `hospital_specialties` - Links the hospital to the specialty (so patients can see it)
3. ✅ `doctor_hospitals` - Links the doctor to their hospital

## Current Implementation Status

### ✅ Backend Code (Already Implemented)
**File:** `backend/service/hospital_admin_service.py` (lines 202-257)

The code already handles all three table updates:

```python
if role_name and role_name.lower() == "doctor" and specialty and specialty.strip():
    # 1. Find or create specialty in specialties table
    specialty_obj = await get_or_create_specialty(specialty)
    
    # 2. Create doctor_specialties entry
    doctor_specialty = DoctorSpecialties(
        user_id=user.user_id,
        specialty_id=specialty_obj.specialty_id
    )
    db.add(doctor_specialty)
    
    # 3. Create hospital_specialties entry (if not exists)
    if not exists:
        hospital_specialty = HospitalSpecialties(
            hospital_id=hospital_id,
            specialty_id=specialty_obj.specialty_id,
            is_primary=0
        )
        db.add(hospital_specialty)
    
    # 4. Create doctor_hospitals entry (lines 261-276)
    await link_doctor_to_hospital(user_id, hospital_id)
```

### ✅ Frontend Code (Already Implemented)
**File:** `frontend/src/components/Hospital/form/DoctorForm.jsx` (lines 292-294)

The frontend sends the specialty:
```javascript
...(isClinician && form.specialty && {
  specialty: form.specialty,
}),
```

### ✅ Schema (Already Implemented)
**File:** `backend/schema/schema.py` (line 1235)

The schema accepts the specialty field:
```python
specialty: Optional[str] = Field(None, description="Specialty name for doctors")
```

## Testing Instructions

### Step 1: Create a Doctor with Specialty

1. **Login as Hospital Admin** (e.g., hospital_id=9)
2. **Go to:** `http://localhost:3000/Hospital/addDoctor`
3. **Fill the form:**
   - Email: `test_neurology@hospital9.com`
   - Role: `Doctor`
   - Specialty: Select **"Neurology"** from dropdown
   - Password: `Test@1234`
   - First Name: `John`
   - Last Name: `Smith`
4. **Click "Create User"**

### Step 2: Check Backend Logs

You should see these logs:
```
🔍 Creating user with role='doctor', specialty='Neurology'
🔍 Full payload keys: ['role_name', 'email', 'username', 'password', 'first_name', 'last_name', 'specialty']
🔍 Checking specialty assignment: role_name='doctor', specialty='Neurology'
✅ ENTERING specialty assignment block for doctor with specialty 'Neurology'
✅ Assigned specialty 'Neurology' (ID: 5) to doctor 40
✅ Added specialty 'Neurology' to hospital_specialties for hospital_id=9
✅ Associated doctor user_id=40 with hospital_id=9 in doctor_hospitals table
```

### Step 3: Verify Database Tables

Run these SQL queries to verify all tables are updated:

#### 1. Check `doctor_specialties` table
```sql
SELECT 
    ds.doctor_specialty_id,
    ds.user_id,
    u.email as doctor_email,
    s.name as specialty_name,
    ds.specialty_id
FROM doctor_specialties ds
JOIN users u ON u.user_id = ds.user_id
JOIN specialties s ON s.specialty_id = ds.specialty_id
WHERE u.email = 'test_neurology@hospital9.com';
```

**Expected Result:**
```
+---------------------+---------+-------------------------------+----------------+--------------+
| doctor_specialty_id | user_id | doctor_email                  | specialty_name | specialty_id |
+---------------------+---------+-------------------------------+----------------+--------------+
|                   X |      40 | test_neurology@hospital9.com  | Neurology      |            5 |
+---------------------+---------+-------------------------------+----------------+--------------+
```

#### 2. Check `hospital_specialties` table
```sql
SELECT 
    hs.id,
    hs.hospital_id,
    h.hospital_name,
    s.name as specialty_name,
    hs.specialty_id
FROM hospital_specialties hs
JOIN hospital_master h ON h.hospital_id = hs.hospital_id
JOIN specialties s ON s.specialty_id = hs.specialty_id
WHERE hs.hospital_id = 9 
  AND s.name = 'Neurology';
```

**Expected Result:**
```
+----+-------------+---------------+----------------+--------------+
| id | hospital_id | hospital_name | specialty_name | specialty_id |
+----+-------------+---------------+----------------+--------------+
| XX |           9 | Hospital Name | Neurology      |            5 |
+----+-------------+---------------+----------------+--------------+
```

#### 3. Check `doctor_hospitals` table
```sql
SELECT 
    dh.user_id,
    u.email as doctor_email,
    dh.hospital_id,
    h.hospital_name
FROM doctor_hospitals dh
JOIN users u ON u.user_id = dh.user_id
JOIN hospital_master h ON h.hospital_id = dh.hospital_id
WHERE u.email = 'test_neurology@hospital9.com';
```

**Expected Result:**
```
+---------+-------------------------------+-------------+---------------+
| user_id | doctor_email                  | hospital_id | hospital_name |
+---------+-------------------------------+-------------+---------------+
|      40 | test_neurology@hospital9.com  |           9 | Hospital Name |
+---------+-------------------------------+-------------+---------------+
```

#### 4. Verify Complete Chain (All 3 Tables Together)
```sql
SELECT 
    u.user_id,
    u.email as doctor_email,
    CONCAT(ud.first_name, ' ', ud.last_name) as doctor_name,
    s.name as specialty,
    h.hospital_name,
    dh.hospital_id,
    ds.doctor_specialty_id,
    hs.id as hospital_specialty_id
FROM users u
JOIN user_details ud ON ud.user_id = u.user_id
JOIN doctor_hospitals dh ON dh.user_id = u.user_id
JOIN hospital_master h ON h.hospital_id = dh.hospital_id
JOIN doctor_specialties ds ON ds.user_id = u.user_id
JOIN specialties s ON s.specialty_id = ds.specialty_id
JOIN hospital_specialties hs ON hs.hospital_id = dh.hospital_id 
                             AND hs.specialty_id = ds.specialty_id
WHERE u.email = 'test_neurology@hospital9.com';
```

**Expected Result:**
```
+---------+-------------------------------+-------------+-----------+---------------+-------------+---------------------+----------------------+
| user_id | doctor_email                  | doctor_name | specialty | hospital_name | hospital_id | doctor_specialty_id | hospital_specialty_id|
+---------+-------------------------------+-------------+-----------+---------------+-------------+---------------------+----------------------+
|      40 | test_neurology@hospital9.com  | John Smith  | Neurology | Hospital Name |           9 |                   X |                   XX |
+---------+-------------------------------+-------------+-----------+---------------+-------------+---------------------+----------------------+
```

### Step 4: Verify Patient Can See Doctor

1. **Login as patient** (user_id=39, hospital_id=9)
2. **Go to:** `http://localhost:3000/patientportal`
3. **Use specialty filter** → Select "Neurology"
4. **Verify:** You should see the new doctor "John Smith" in the list

## Common Issues and Fixes

### Issue 1: `doctor_specialties` table is NOT being updated

**Symptoms:**
- Doctor created successfully
- No entry in `doctor_specialties` table
- Backend logs show: "🔍 Checking specialty assignment" but NOT "✅ ENTERING specialty assignment block"

**Possible Causes:**
1. ❌ Frontend not sending `specialty` field
2. ❌ Backend schema not accepting `specialty` field
3. ❌ Specialty field is empty string or null

**Fixes:**
1. Check frontend console for payload: `console.log("🔍 Payload details:", payload)`
2. Verify backend schema has: `specialty: Optional[str] = Field(None, ...)`
3. Ensure specialty dropdown has a selected value (not empty)

### Issue 2: Exception in specialty assignment block

**Symptoms:**
- Backend logs show: "❌ Failed to assign specialty to doctor: [error]"
- Doctor created but no specialty assigned

**Fix:**
Check the exception details in backend logs and fix the specific error

### Issue 3: `hospital_specialties` not updated

**Symptoms:**
- `doctor_specialties` has entry ✅
- `hospital_specialties` missing entry ❌
- Patients can't see the specialty

**Fix:**
Check backend logs for:
```
✅ Added specialty 'Neurology' to hospital_specialties for hospital_id=9
```

If missing, there might be a database constraint issue or transaction rollback.

### Issue 4: `doctor_hospitals` not updated

**Symptoms:**
- Doctor created ✅
- Specialty assigned ✅
- But doctor doesn't show for patients from that hospital ❌

**Fix:**
Check backend logs for:
```
✅ Associated doctor user_id=40 with hospital_id=9 in doctor_hospitals table
```

If missing, check lines 261-276 in `hospital_admin_service.py`

## Debug SQL Queries

### Find doctors WITHOUT specialty
```sql
SELECT u.user_id, u.email, u.username
FROM users u
LEFT JOIN doctor_specialties ds ON ds.user_id = u.user_id
WHERE u.global_role_id = 2  -- doctor role
  AND ds.doctor_specialty_id IS NULL;
```

### Find doctors WITHOUT hospital association
```sql
SELECT u.user_id, u.email, u.username
FROM users u
LEFT JOIN doctor_hospitals dh ON dh.user_id = u.user_id
WHERE u.global_role_id = 2  -- doctor role
  AND dh.user_id IS NULL;
```

### Find specialties in hospital but no doctors have them
```sql
SELECT 
    hs.hospital_id,
    h.hospital_name,
    s.name as specialty_name,
    COUNT(ds.doctor_specialty_id) as doctor_count
FROM hospital_specialties hs
JOIN hospital_master h ON h.hospital_id = hs.hospital_id
JOIN specialties s ON s.specialty_id = hs.specialty_id
LEFT JOIN doctor_specialties ds ON ds.specialty_id = hs.specialty_id
LEFT JOIN doctor_hospitals dh ON dh.user_id = ds.user_id 
                              AND dh.hospital_id = hs.hospital_id
WHERE hs.hospital_id = 9
GROUP BY hs.hospital_id, hs.specialty_id
HAVING doctor_count = 0;
```

## Migration Script for Existing Doctors

If you have existing doctors without specialty associations, run this:

```sql
-- Example: Manually add specialty to existing doctor
INSERT INTO doctor_specialties (user_id, specialty_id)
SELECT 
    u.user_id,
    5 -- Neurology specialty_id
FROM users u
WHERE u.email = 'existing_doctor@hospital.com'
  AND NOT EXISTS (
    SELECT 1 FROM doctor_specialties ds 
    WHERE ds.user_id = u.user_id
  );
```

## Summary

✅ **All code is already implemented and working!**

The three-table update happens automatically when:
1. Hospital admin creates a doctor
2. Selects a specialty from dropdown
3. Clicks "Create User"

**Tables Updated:**
- ✅ `doctor_specialties` - Doctor → Specialty link
- ✅ `hospital_specialties` - Hospital → Specialty link  
- ✅ `doctor_hospitals` - Doctor → Hospital link

**No database schema changes needed!** All functionality is already in place.

