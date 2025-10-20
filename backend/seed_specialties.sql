-- Seed common medical specialties
INSERT INTO specialties (name, description, status) VALUES
('Cardiology', 'Heart and cardiovascular system', 'active'),
('Neurology', 'Brain and nervous system', 'active'),
('Pediatrics', 'Medical care of infants, children, and adolescents', 'active'),
('Orthopedics', 'Musculoskeletal system', 'active'),
('Dermatology', 'Skin, hair, and nails', 'active'),
('Psychiatry', 'Mental health and behavioral disorders', 'active'),
('Radiology', 'Medical imaging and diagnosis', 'active'),
('Internal Medicine', 'Prevention, diagnosis, and treatment of adult diseases', 'active'),
('General Surgery', 'Surgical procedures', 'active'),
('Gynecology', 'Female reproductive system', 'active'),
('Ophthalmology', 'Eye and vision care', 'active'),
('ENT (Otolaryngology)', 'Ear, nose, and throat', 'active'),
('Oncology', 'Cancer treatment', 'active'),
('Endocrinology', 'Hormones and metabolism', 'active'),
('Gastroenterology', 'Digestive system', 'active')
ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    status = VALUES(status),
    updated_at = CURRENT_TIMESTAMP;

