-- Add description and is_core to transaction_categories for Admin Categories UI
ALTER TABLE transaction_categories ADD COLUMN description TEXT;
ALTER TABLE transaction_categories ADD COLUMN is_core BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing seeded categories as core
UPDATE transaction_categories SET is_core = true;
