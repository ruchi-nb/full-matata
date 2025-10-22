-- ============================================================================
-- MIGRATION: Add existing doctor specialties to hospital_specialties
-- ============================================================================
-- This script finds all doctors with specialties and ensures their hospital
-- also has those specialties in the hospital_specialties table
-- ============================================================================

SELECT '=== MIGRATION: Syncing doctor specialties to hospital_specialties ===' as info;

-- Step 1: Show what will be added
SELECT 
    'PREVIEW: Specialties to be added to hospitals' as info,
    dh.hospital_id,
    ds.specialty_id,
    s.name as specialty_name,
    u.username as doctor_username
FROM doctor_specialties ds
JOIN doctor_hospitals dh ON dh.user_id = ds.user_id
JOIN specialties s ON s.specialty_id = ds.specialty_id
JOIN users u ON u.user_id = ds.user_id
WHERE NOT EXISTS (
    SELECT 1 FROM hospital_specialties hs
    WHERE hs.hospital_id = dh.hospital_id
    AND hs.specialty_id = ds.specialty_id
)
ORDER BY dh.hospital_id, s.name;

-- Step 2: Insert missing hospital_specialties entries
-- This automatically adds hospital specialties based on doctor specialties
INSERT INTO hospital_specialties (hospital_id, specialty_id, is_primary, created_at)
SELECT DISTINCT
    dh.hospital_id,
    ds.specialty_id,
    0 as is_primary,
    NOW() as created_at
FROM doctor_specialties ds
JOIN doctor_hospitals dh ON dh.user_id = ds.user_id
WHERE NOT EXISTS (
    SELECT 1 FROM hospital_specialties hs
    WHERE hs.hospital_id = dh.hospital_id
    AND hs.specialty_id = ds.specialty_id
);

-- Step 3: Show what was added
SELECT 
    '=== MIGRATION COMPLETE: Added hospital_specialties ===' as info,
    hs.hospital_id,
    hs.specialty_id,
    s.name as specialty_name,
    COUNT(ds.user_id) as num_doctors
FROM hospital_specialties hs
JOIN specialties s ON s.specialty_id = hs.specialty_id
LEFT JOIN doctor_specialties ds ON ds.specialty_id = hs.specialty_id
LEFT JOIN doctor_hospitals dh ON dh.user_id = ds.user_id AND dh.hospital_id = hs.hospital_id
GROUP BY hs.hospital_id, hs.specialty_id, s.name
ORDER BY hs.hospital_id, s.name;

-- Step 4: Verify - Show all hospitals with their specialties
SELECT 
    '=== VERIFICATION: Hospitals and their specialties ===' as info,
    hm.hospital_id,
    hm.hospital_name,
    GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') as specialties
FROM hospital_master hm
LEFT JOIN hospital_specialties hs ON hs.hospital_id = hm.hospital_id
LEFT JOIN specialties s ON s.specialty_id = hs.specialty_id
GROUP BY hm.hospital_id, hm.hospital_name
ORDER BY hm.hospital_id;

-- Step 5: Verify - Show patients and what they should see
SELECT 
    '=== VERIFICATION: What each patient should see ===' as info,
    ph.user_id as patient_id,
    u.username as patient_username,
    ph.hospital_id,
    GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') as available_specialties
FROM patient_hospitals ph
JOIN users u ON u.user_id = ph.user_id
LEFT JOIN hospital_specialties hs ON hs.hospital_id = ph.hospital_id
LEFT JOIN specialties s ON s.specialty_id = hs.specialty_id AND s.status = 'active'
WHERE ph.is_active = 1
GROUP BY ph.user_id, u.username, ph.hospital_id
ORDER BY ph.user_id;

SELECT '=== MIGRATION COMPLETE ===' as info;
SELECT 'Patients should now see specialties when they log in to the patient portal' as next_step;

