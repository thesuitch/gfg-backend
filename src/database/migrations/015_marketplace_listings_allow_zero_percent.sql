-- Allow percentage_offered = 0 while a full listing is reserved in a pending transfer.
-- Purchase reduces remaining % on the listing; ownership moves only after seller confirms payment.

ALTER TABLE marketplace_listings
  DROP CONSTRAINT IF EXISTS marketplace_listings_percentage_offered_check;

ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_percentage_offered_check
  CHECK (percentage_offered >= 0 AND percentage_offered <= 100);
