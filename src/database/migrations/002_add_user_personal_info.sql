-- Migration: add_user_personal_info
-- Created: 2024-01-01T00:00:00.000Z

-- Add personal information fields to users table
ALTER TABLE users ADD COLUMN country VARCHAR(100);
ALTER TABLE users ADD COLUMN street_address TEXT;
ALTER TABLE users ADD COLUMN city VARCHAR(100);
ALTER TABLE users ADD COLUMN state VARCHAR(100);
ALTER TABLE users ADD COLUMN zip_code VARCHAR(20);
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Add indexes for better performance on new fields
CREATE INDEX idx_users_country ON users(country);
CREATE INDEX idx_users_city ON users(city);
CREATE INDEX idx_users_state ON users(state);
CREATE INDEX idx_users_phone ON users(phone);
