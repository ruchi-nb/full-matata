-- =====================================================================
-- TRANSCRIPT PERMISSIONS SEEDING SCRIPT
-- =====================================================================
-- This script adds permissions for role-based transcript access
-- Run this after the main database setup is complete
-- =====================================================================

-- Insert transcript permissions
INSERT IGNORE INTO permission_master (permission_name, description, created_at, updated_at)
VALUES
    ('patient.transcripts.view', 'Allows patients to view their own consultation transcripts', NOW(), NOW()),
    ('doctor.transcripts.view', 'Allows doctors to view transcripts of consultations they conducted', NOW(), NOW()),
    ('hospital_admin.transcripts.view', 'Allows hospital admins to view all transcripts from their hospital', NOW(), NOW()),
    ('transcripts.view', 'General permission to view transcripts (access controlled by role)', NOW(), NOW());

-- =====================================================================
-- ASSIGN PERMISSIONS TO ROLES
-- =====================================================================

-- Get role IDs (assuming roles exist from previous setup)
SET @patient_role_id = (SELECT role_id FROM role_master WHERE role_name = 'patient' LIMIT 1);
SET @doctor_role_id = (SELECT role_id FROM role_master WHERE role_name = 'doctor' LIMIT 1);
SET @hospital_admin_role_id = (SELECT role_id FROM role_master WHERE role_name = 'hospital_admin' LIMIT 1);
SET @superadmin_role_id = (SELECT role_id FROM role_master WHERE role_name = 'superadmin' LIMIT 1);

-- Get permission IDs
SET @patient_transcript_perm = (SELECT permission_id FROM permission_master WHERE permission_name = 'patient.transcripts.view' LIMIT 1);
SET @doctor_transcript_perm = (SELECT permission_id FROM permission_master WHERE permission_name = 'doctor.transcripts.view' LIMIT 1);
SET @hospital_admin_transcript_perm = (SELECT permission_id FROM permission_master WHERE permission_name = 'hospital_admin.transcripts.view' LIMIT 1);
SET @general_transcript_perm = (SELECT permission_id FROM permission_master WHERE permission_name = 'transcripts.view' LIMIT 1);

-- Assign permissions to patient role
INSERT IGNORE INTO role_permission (role_id, permission_id, created_at)
VALUES 
    (@patient_role_id, @patient_transcript_perm, NOW()),
    (@patient_role_id, @general_transcript_perm, NOW());

-- Assign permissions to doctor role
INSERT IGNORE INTO role_permission (role_id, permission_id, created_at)
VALUES 
    (@doctor_role_id, @doctor_transcript_perm, NOW()),
    (@doctor_role_id, @general_transcript_perm, NOW());

-- Assign permissions to hospital_admin role
INSERT IGNORE INTO role_permission (role_id, permission_id, created_at)
VALUES 
    (@hospital_admin_role_id, @hospital_admin_transcript_perm, NOW()),
    (@hospital_admin_role_id, @general_transcript_perm, NOW());

-- Assign all transcript permissions to superadmin
INSERT IGNORE INTO role_permission (role_id, permission_id, created_at)
VALUES 
    (@superadmin_role_id, @patient_transcript_perm, NOW()),
    (@superadmin_role_id, @doctor_transcript_perm, NOW()),
    (@superadmin_role_id, @hospital_admin_transcript_perm, NOW()),
    (@superadmin_role_id, @general_transcript_perm, NOW());

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================
-- Run these to verify permissions were added correctly

-- Check all transcript permissions
SELECT 
    pm.permission_id,
    pm.permission_name,
    pm.description,
    COUNT(rp.role_id) as assigned_to_roles
FROM permission_master pm
LEFT JOIN role_permission rp ON pm.permission_id = rp.permission_id
WHERE pm.permission_name LIKE '%transcript%'
GROUP BY pm.permission_id, pm.permission_name, pm.description;

-- Check role assignments for transcript permissions
SELECT 
    rm.role_name,
    pm.permission_name
FROM role_permission rp
JOIN role_master rm ON rp.role_id = rm.role_id
JOIN permission_master pm ON rp.permission_id = pm.permission_id
WHERE pm.permission_name LIKE '%transcript%'
ORDER BY rm.role_name, pm.permission_name;

-- =====================================================================
-- DONE! Transcript permissions seeded successfully
-- =====================================================================

