-- Migration: align_horses_with_frontend
-- Align horses schema and constraints with frontend admin horse module

-- Expand columns for client-facing values and base64 images
ALTER TABLE horses ALTER COLUMN horse_type TYPE VARCHAR(100);
ALTER TABLE horses ALTER COLUMN image_url TYPE TEXT;

-- New fields used by the admin form
ALTER TABLE horses ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS is_new BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS sale_price DECIMAL(12,2) CHECK (sale_price IS NULL OR sale_price >= 0);
ALTER TABLE horses ADD COLUMN IF NOT EXISTS lifetime_past_performance_url TEXT;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS pedigree_url TEXT;

-- Migrate legacy status values before replacing constraint
ALTER TABLE horses DROP CONSTRAINT IF EXISTS horses_status_check;

UPDATE horses SET is_new = true WHERE status = 'new';
UPDATE horses SET is_new = false WHERE status = 'old';
UPDATE horses SET status = 'active' WHERE status IN ('new', 'old');

ALTER TABLE horses ADD CONSTRAINT horses_status_check
  CHECK (status IN ('active', 'retired', 'sold', 'inactive'));

ALTER TABLE horses DROP CONSTRAINT IF EXISTS horses_horse_type_check;
ALTER TABLE horses ADD CONSTRAINT horses_horse_type_check
  CHECK (horse_type IN (
    'standardbred', 'thoroughbred', 'quarter_horse', 'arabian', 'other',
    'Yearling/Baby', 'Stakes Racehorse', 'Conditioned Racehorse'
  ));

ALTER TABLE horses DROP CONSTRAINT IF EXISTS horses_age_category_check;
ALTER TABLE horses ADD CONSTRAINT horses_age_category_check
  CHECK (age_category IN ('1YO', '2YO', '3YO', '4YO', '4YO+', '5YO', '6YO', '7YO', '8YO+'));

CREATE INDEX IF NOT EXISTS idx_horses_archived ON horses(archived);
