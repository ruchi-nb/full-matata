-- Seed common permissions for hospital RBAC
INSERT INTO permission_master (permission_name, description) VALUES
-- Patient Management Permissions
('patient.create', 'Add new patients to the hospital'),
('patient.view', 'View patient profiles and information'),
('patient.update', 'Edit patient information and profiles'),
('patient.delete', 'Delete patients (soft delete)'),
('patient.list', 'List all patients in the hospital'),

-- Doctor Management Permissions
('doctor.create', 'Add new doctors to the hospital'),
('doctor.view', 'View doctor profiles and information'),
('doctor.update', 'Edit doctor information and profiles'),
('doctor.delete', 'Delete doctors (soft delete)'),
('doctor.list', 'List all doctors in the hospital'),

-- Consultation Permissions
('consultation.create', 'Create new consultations'),
('consultation.view', 'View consultation details'),
('consultation.update', 'Update consultation information'),
('consultation.delete', 'Delete consultations'),
('consultation.list', 'List all consultations'),

-- Reports & Analytics Permissions
('reports.view', 'View hospital reports and analytics'),
('reports.export', 'Export reports and data'),
('analytics.view', 'View analytics dashboards'),

-- Hospital Management Permissions
('hospital.profile.view', 'View hospital profile'),
('hospital.profile.update', 'Update hospital profile'),
('hospital.statistics.view', 'View hospital statistics'),
('hospital.specialities.list', 'List hospital specialties'),
('hospital.speciality.create', 'Create new specialties'),
('hospital.speciality.update', 'Update specialty information'),
('hospital.speciality.delete', 'Delete specialties'),

-- Role Management Permissions
('role.create', 'Create custom roles'),
('role.view', 'View role information'),
('role.update', 'Update role permissions'),
('role.delete', 'Delete roles'),
('role.list', 'List all roles')

ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    updated_at = CURRENT_TIMESTAMP;

