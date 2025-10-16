-- Migration: Add hospital_specialties table
-- This table creates a many-to-many relationship between hospitals and specialties

CREATE TABLE hospital_specialties (
    hospital_specialty_id INT PRIMARY KEY AUTO_INCREMENT,
    hospital_id INT NOT NULL,
    specialty_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (hospital_id) REFERENCES hospital_master(hospital_id) ON DELETE CASCADE,
    FOREIGN KEY (specialty_id) REFERENCES specialties(specialty_id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_hs_spec (specialty_id),
    INDEX idx_hs_hosp (hospital_id),
    
    -- Unique constraint to prevent duplicate hospital-specialty mappings
    UNIQUE KEY uq_hs_hosp_spec (hospital_id, specialty_id)
) ENGINE=InnoDB;
