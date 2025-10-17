-- Add patient.consultation.create permission
INSERT INTO permissions (permission_key, description, created_at) 
VALUES ('patient.consultation.create', 'Create consultations as a patient', NOW())
ON CONFLICT (permission_key) DO NOTHING;

-- Add the permission to the patient role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'patient' AND p.permission_key = 'patient.consultation.create'
ON CONFLICT (role_id, permission_id) DO NOTHING;
