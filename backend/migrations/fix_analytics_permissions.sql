-- Fix Analytics Permissions for Patient Role
-- This script assigns the analytics.log permission to the patient role
-- to resolve 403 Forbidden errors when patients try to log analytics events

-- First, ensure the analytics.log permission exists
INSERT IGNORE INTO permission_master (permission_id, permission_name, description) 
VALUES (50, 'analytics.log', 'Permission for analytics.log');

-- Get the patient role ID (assuming it's role_id = 4 based on the logs)
-- If the role ID is different, update the query below
SET @patient_role_id = (SELECT role_id FROM role_master WHERE role_name = 'patient' LIMIT 1);

-- Assign analytics.log permission to patient role
INSERT IGNORE INTO role_permission (role_id, permission_id) 
VALUES (@patient_role_id, 50);

-- Also assign to other roles that might need it
-- Doctor role
SET @doctor_role_id = (SELECT role_id FROM role_master WHERE role_name = 'doctor' LIMIT 1);
INSERT IGNORE INTO role_permission (role_id, permission_id) 
VALUES (@doctor_role_id, 50);

-- Admin role (if not already assigned)
SET @admin_role_id = (SELECT role_id FROM role_master WHERE role_name = 'admin' LIMIT 1);
INSERT IGNORE INTO role_permission (role_id, permission_id) 
VALUES (@admin_role_id, 50);

-- Verify the assignments
SELECT 
    rm.role_name,
    pm.permission_name,
    pm.description
FROM role_master rm
JOIN role_permission rp ON rm.role_id = rp.role_id
JOIN permission_master pm ON rp.permission_id = pm.permission_id
WHERE pm.permission_name = 'analytics.log'
ORDER BY rm.role_name;
