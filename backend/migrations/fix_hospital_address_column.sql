-- Migration: Fix hospital_master table schema
-- Change first_name column to address to match the model

ALTER TABLE hospital_master CHANGE COLUMN first_name address VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
