-- ============================================================================
-- DIAGNOSTIC SQL SCRIPT: Check why patient is not seeing specialties
-- ============================================================================

-- STEP 1: Find all patients
SELECT '=== STEP 1: ALL PATIENTS ===' as step;
SELECT user_id, username, email, global_role_id 
FROM users 
WHERE global_role_id = 4
ORDER BY user_id DESC
LIMIT 10;

-- STEP 2: Check if patients are in patient_hospitals
-- Replace <patient_user_id> with actual patient user_id from above
SELECT '=== STEP 2: PATIENT IN PATIENT_HOSPITALS? ===' as step;
SELECT * FROM patient_hospitals 
WHERE user_id = 14;  -- CHANGE THIS to your patient user_id

-- If EMPTY in step 2, run this fix:
-- INSERT INTO patient_hospitals (user_id, hospital_id, is_active, registered_on)
-- VALUES (14, 5, 1, NOW());  -- Change user_id and hospital_id


-- STEP 3: Find hospital_id for the patient
SELECT '=== STEP 3: WHICH HOSPITAL IS PATIENT IN? ===' as step;
SELECT ph.*, hm.hospital_name 
FROM patient_hospitals ph
JOIN hospital_master hm ON hm.hospital_id = ph.hospital_id
WHERE ph.user_id = 14;  -- CHANGE THIS


-- STEP 4: Check hospital_specialties for that hospital
SELECT '=== STEP 4: SPECIALTIES IN HOSPITAL ===' as step;
SELECT hs.*, s.name as specialty_name, s.status
FROM hospital_specialties hs
JOIN specialties s ON s.specialty_id = hs.specialty_id
WHERE hs.hospital_id = 5;  -- CHANGE THIS to hospital_id from step 3

-- If EMPTY in step 4, it means NO specialties are assigned to the hospital!
-- This is the problem!


-- STEP 5: Check all specialties in database
SELECT '=== STEP 5: ALL SPECIALTIES IN DATABASE ===' as step;
SELECT specialty_id, name, description, status
FROM specialties
WHERE status = 'active'
ORDER BY name;


-- STEP 6: Check doctors with specialties in the hospital
SELECT '=== STEP 6: DOCTORS WITH SPECIALTIES ===' as step;
SELECT 
    u.user_id,
    u.username,
    u.email,
    s.name as specialty_name,
    ds.specialty_id
FROM users u
JOIN doctor_specialties ds ON ds.user_id = u.user_id
JOIN specialties s ON s.specialty_id = ds.specialty_id
WHERE u.user_id IN (
    SELECT user_id FROM doctor_hospitals WHERE hospital_id = 5  -- CHANGE THIS
);


-- STEP 7: Check if doctor is in doctor_hospitals
SELECT '=== STEP 7: DOCTORS IN HOSPITAL ===' as step;
SELECT dh.*, u.username, u.email
FROM doctor_hospitals dh
JOIN users u ON u.user_id = dh.user_id
WHERE dh.hospital_id = 5;  -- CHANGE THIS


-- ============================================================================
-- SUMMARY: What should exist for patient to see specialties
-- ============================================================================
-- 1. patient_hospitals: patient_id → hospital_id (link patient to hospital)
-- 2. hospital_specialties: hospital_id → specialty_id (hospital offers specialty)
-- 3. specialties: specialty with status='active'
-- 4. doctor_specialties: doctor_id → specialty_id (doctor has specialty)
-- 5. doctor_hospitals: doctor_id → hospital_id (doctor works at hospital)

-- If ANY of these is missing, patient won't see specialties!


-- ============================================================================
-- QUICK FIXES
-- ============================================================================

-- FIX 1: Add patient to hospital
-- INSERT INTO patient_hospitals (user_id, hospital_id, is_active, registered_on)
-- VALUES (14, 5, 1, NOW());

-- FIX 2: Add specialty to hospital (if doctor already has it)
-- INSERT INTO hospital_specialties (hospital_id, specialty_id, is_primary)
-- VALUES (5, <specialty_id>, 0);

-- FIX 3: Add doctor to hospital
-- INSERT INTO doctor_hospitals (user_id, hospital_id)
-- VALUES (<doctor_user_id>, 5);

