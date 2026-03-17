-- Add signage to transaction_categories: Positive, Negative, or Both
ALTER TABLE transaction_categories
  ADD COLUMN signage VARCHAR(20) NOT NULL DEFAULT 'positive'
  CHECK (signage IN ('positive', 'negative', 'both'));

-- Backfill: existing rows with allows_negative = true become 'both', else 'positive'
UPDATE transaction_categories SET signage = CASE WHEN allows_negative THEN 'both' ELSE 'positive' END;
