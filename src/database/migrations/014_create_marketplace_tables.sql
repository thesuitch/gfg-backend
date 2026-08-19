-- Marketplace: member-to-member share listings, offers, and transfers.

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  horse_id INTEGER NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  -- 0 allowed while remaining % is reserved on a pending transfer (sold after confirm)
  percentage_offered DECIMAL(5,2) NOT NULL CHECK (percentage_offered >= 0 AND percentage_offered <= 100),
  price_per_percent DECIMAL(12,2) NOT NULL CHECK (price_per_percent > 0),
  accept_offers BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'sold', 'expired', 'cancelled')),
  list_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller ON marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_horse ON marketplace_listings(horse_id);

CREATE TABLE IF NOT EXISTS marketplace_offers (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  percentage_requested DECIMAL(5,2) NOT NULL CHECK (percentage_requested >= 1 AND percentage_requested <= 100),
  offer_amount DECIMAL(12,2) NOT NULL CHECK (offer_amount > 0),
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiry_date DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_marketplace_offers_listing ON marketplace_offers(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_offers_buyer ON marketplace_offers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_offers_status ON marketplace_offers(status);

CREATE TABLE IF NOT EXISTS marketplace_transfers (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  offer_id INTEGER REFERENCES marketplace_offers(id) ON DELETE SET NULL,
  seller_id INTEGER NOT NULL REFERENCES users(id),
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  horse_id INTEGER NOT NULL REFERENCES horses(id),
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
  transfer_fee DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (transfer_fee >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'cancelled')),
  transfer_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_by INTEGER REFERENCES users(id),
  confirmed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketplace_transfers_listing ON marketplace_transfers(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_transfers_seller ON marketplace_transfers(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_transfers_buyer ON marketplace_transfers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_transfers_status ON marketplace_transfers(status);
