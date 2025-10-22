-- Verify patient abba@gmail.com (user_id 24, hospital 5)

-- 1. Is patient in patient_hospitals?
SELECT 'Patient in patient_hospitals?' as check_name;
SELECT * FROM patient_hospitals WHERE user_id = 24;

-- 2. What specialties does hospital 5 have?
SELECT 'Hospital 5 specialties in hospital_specialties?' as check_name;
SELECT hs.*, s.name, s.status 
FROM hospital_specialties hs
JOIN specialties s ON s.specialty_id = hs.specialty_id
WHERE hs.hospital_id = 5;

-- 3. Are those specialties active?
SELECT 'Active specialties for hospital 5?' as check_name;
SELECT s.specialty_id, s.name, s.status
FROM hospital_specialties hs
JOIN specialties s ON s.specialty_id = hs.specialty_id
WHERE hs.hospital_id = 5 AND s.status = 'active';

-- 4. Full query that backend should run
SELECT 'What backend query should return?' as check_name;
SELECT s.specialty_id, s.name, s.description, s.status
FROM patient_hospitals ph
JOIN hospital_specialties hs ON hs.hospital_id = ph.hospital_id
JOIN specialties s ON s.specialty_id = hs.specialty_id
WHERE ph.user_id = 24 
  AND ph.is_active = 1 
  AND s.status = 'active';

