-- Quick diagnostic for your specific case

-- 1. Which doctors are in hospital 5?
SELECT 'Doctors in Hospital 5:' as info;
SELECT u.user_id, u.username, u.email
FROM users u
JOIN doctor_hospitals dh ON dh.user_id = u.user_id
WHERE dh.hospital_id = 5;

-- 2. Which patients are in hospital 5?
SELECT 'Patients in Hospital 5:' as info;
SELECT u.user_id, u.username, u.email, ph.is_active
FROM users u
JOIN patient_hospitals ph ON ph.user_id = u.user_id
WHERE ph.hospital_id = 5;

-- 3. What specialties does hospital 5 have?
SELECT 'Hospital 5 Specialties:' as info;
SELECT hs.*, s.name, s.status
FROM hospital_specialties hs
JOIN specialties s ON s.specialty_id = hs.specialty_id
WHERE hs.hospital_id = 5;

-- 4. What should patient see?
SELECT 'What Patient in Hospital 5 Should See:' as info;
SELECT s.specialty_id, s.name, s.description, s.status
FROM hospital_specialties hs
JOIN specialties s ON s.specialty_id = hs.specialty_id
WHERE hs.hospital_id = 5 AND s.status = 'active';

