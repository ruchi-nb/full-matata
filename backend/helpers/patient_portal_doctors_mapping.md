# Patient Portal - Doctors Listing by Specialty

## Overview
Implemented a complete flow for patients to view doctors filtered by specialty from their hospital.

## Database Tables Used

### Flow Diagram
```
patient clicks specialty card
    ↓
frontend navigates to /patientportal/doctors?specialty_id=X
    ↓
backend GET /patients/doctors?specialty_id=X
    ↓
Query:
1. patient_hospitals (find patient's hospital_id by user_id)
2. doctor_hospitals (find doctors in same hospital_id)
3. doctor_specialties (filter doctors by specialty_id)
4. users + user_details (get doctor info)
5. specialties (get specialty names)
```

## Backend Implementation

### New Endpoint: `GET /patients/doctors`
**File:** `backend/routes/patients_router.py`

**Query Parameters:**
- `specialty_id` (optional): Filter doctors by specialty

**Logic:**
1. Get patient's `user_id` from JWT token
2. Query `patient_hospitals` to find hospital(s) patient belongs to
3. Query `doctor_hospitals` to find all doctors in those hospital(s)
4. If `specialty_id` provided, join with `doctor_specialties` to filter
5. Return doctor details with their specialties array

**Response Format:**
```json
{
  "doctors": [
    {
      "user_id": 23,
      "username": "dr_john",
      "email": "john@hospital.com",
      "first_name": "John",
      "last_name": "Doe",
      "phone": "+1234567890",
      "gender": "male",
      "specialties": [
        {
          "specialty_id": 5,
          "name": "Neurology",
          "description": "Brain and nervous system"
        }
      ],
      "specialty": "Neurology"
    }
  ]
}
```

**Tenant Isolation:**
- ✅ Patient can ONLY see doctors from hospitals they are associated with
- ✅ Enforced through `patient_hospitals` → `doctor_hospitals` join
- ✅ No cross-hospital data leakage

## Frontend Implementation

### 1. Specialty Card Navigation
**File:** `frontend/src/components/PatientPortal/home/SpecialtiesSection.jsx`

**Changes:**
- Updated `openSpecialtyModal()` to navigate to doctors page with URL params
- Passes `specialty_id` and `specialty_name` as query parameters

**Navigation:**
```javascript
router.push(`/patientportal/doctors?specialty_id=${specialtyId}&specialty_name=${encodeURIComponent(specialtyName)}`);
```

### 2. Doctors Listing Page
**File:** `frontend/src/components/PatientPortal/home/DoctorModal.jsx`

**Changes:**
- Added `useSearchParams()` to read URL query parameters
- Created `getPatientHospitalDoctors(specialtyId)` API call
- Replaced hardcoded doctors with API data
- Added loading state with spinner
- Updated empty state messages for specialty filtering
- Modified `DoctorCard` to handle both API format and legacy format

**Key Features:**
- Dynamic title: "Neurology Specialists" when filtered by specialty
- Loading indicator while fetching doctors
- Empty state with contextual message
- Fallback avatar with doctor's initial
- Displays doctor's name, email, phone, specialty

### 3. API Client Function
**File:** `frontend/src/data/api-patient.js`

**New Function:**
```javascript
export function getPatientHospitalDoctors(specialtyId = null) {
  const url = specialtyId 
    ? `/patients/doctors?specialty_id=${specialtyId}` 
    : "/patients/doctors";
  console.log("🩺 [PATIENT API] Fetching hospital doctors:", url);
  return request(url, { method: "GET" });
}
```

## Testing Checklist

### Prerequisites
1. ✅ Hospital admin has created doctors with specialties
2. ✅ Doctors are linked to hospital via `doctor_hospitals` table
3. ✅ Doctor specialties are linked via `doctor_specialties` table
4. ✅ Hospital specialties are linked via `hospital_specialties` table
5. ✅ Patient is linked to hospital via `patient_hospitals` table

### Test Steps

#### 1. Test Specialty Filter from Patient Portal
```
1. Login as patient (user_id=39, hospital_id=9)
2. Go to http://localhost:3000/patientportal
3. Click on "Neurology" specialty card
4. Should navigate to /patientportal/doctors?specialty_id=5&specialty_name=Neurology
5. Should see "Neurology Specialists" as title
6. Should see ONLY doctors with Neurology specialty from hospital 9
```

**Expected Backend Logs:**
```
🔍 Fetching doctors for patient user_id=39, specialty_id=5
📋 Query result: Found 1 patient_hospitals entries
🏥 Patient user_id=39 is associated with hospitals: [9]
✅ Found X doctors for patient user_id=39
```

#### 2. Test All Doctors (No Filter)
```
1. Go to http://localhost:3000/patientportal/doctors (no query params)
2. Should see "Available Doctors" as title
3. Should see ALL doctors from patient's hospital(s)
```

#### 3. Test Tenant Isolation
```sql
-- Create a doctor in hospital 5
INSERT INTO doctor_hospitals (user_id, hospital_id) VALUES (99, 5);

-- Patient from hospital 9 should NOT see this doctor
-- Even if they manually set specialty_id in URL
```

#### 4. Test Empty State
```
1. Click specialty with no assigned doctors (e.g., new specialty)
2. Should see "No doctors available for X specialty."
3. Should show "Try checking other specialties or contact your hospital."
4. Should have "Back to Specialties" button
```

## SQL Verification Queries

### Check Patient's Hospital Association
```sql
SELECT * FROM patient_hospitals WHERE user_id = 39;
-- Expected: hospital_id = 9, is_active = 1
```

### Check Doctors in Patient's Hospital
```sql
SELECT u.user_id, u.email, u.username
FROM users u
JOIN doctor_hospitals dh ON dh.user_id = u.user_id
WHERE dh.hospital_id = 9;
```

### Check Doctors with Specific Specialty in Hospital
```sql
SELECT u.user_id, u.email, s.name as specialty
FROM users u
JOIN doctor_hospitals dh ON dh.user_id = u.user_id
JOIN doctor_specialties ds ON ds.user_id = u.user_id
JOIN specialties s ON s.specialty_id = ds.specialty_id
WHERE dh.hospital_id = 9
  AND ds.specialty_id = 5;
```

### Verify Complete Chain for Patient
```sql
-- This shows what the patient should see
SELECT 
    u.user_id,
    CONCAT(ud.first_name, ' ', ud.last_name) as doctor_name,
    s.name as specialty,
    ph.hospital_id as patient_hospital
FROM patient_hospitals ph
JOIN hospital_specialties hs ON hs.hospital_id = ph.hospital_id
JOIN doctor_specialties ds ON ds.specialty_id = hs.specialty_id
JOIN users u ON u.user_id = ds.user_id
JOIN doctor_hospitals dh ON dh.user_id = u.user_id AND dh.hospital_id = ph.hospital_id
JOIN user_details ud ON ud.user_id = u.user_id
JOIN specialties s ON s.specialty_id = ds.specialty_id
WHERE ph.user_id = 39
  AND ph.is_active = 1
  AND s.status = 'active'
ORDER BY s.name, ud.first_name;
```

## Common Issues

### Issue: "No doctors available"
**Causes:**
1. ❌ Doctor not in `doctor_hospitals` for patient's hospital
2. ❌ Doctor not in `doctor_specialties` table
3. ❌ Specialty not in `hospital_specialties` for patient's hospital

**Fix:** Run the doctor creation flow again OR manually insert missing associations

### Issue: Patient sees doctors from other hospitals
**Cause:** Bug in tenant isolation query

**Fix:** Check that the query joins through `patient_hospitals` AND `doctor_hospitals` on the same `hospital_id`

### Issue: API returns 403 Forbidden
**Cause:** Patient's JWT token missing or incorrect permissions

**Fix:** Ensure patient is logged in and has `patient.profile.view` permission

## Architecture Highlights

### Security
- ✅ JWT-based authentication
- ✅ Role-based permission check (`patient.profile.view`)
- ✅ Tenant isolation enforced at query level
- ✅ No direct user_id in URL (uses JWT token)

### Performance
- ✅ Single database query with joins (no N+1 problem)
- ✅ Frontend caching via React state
- ✅ Indexed foreign keys on junction tables

### User Experience
- ✅ Contextual page title based on specialty
- ✅ Loading indicators
- ✅ Empty states with helpful messages
- ✅ Fallback avatars for doctors without photos
- ✅ Responsive grid layout

