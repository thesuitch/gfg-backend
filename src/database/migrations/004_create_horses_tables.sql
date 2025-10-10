-- Migration: create_horses_tables
-- Created: 2024-01-01T00:00:00.000Z

-- Create horses table
CREATE TABLE horses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sire VARCHAR(255) NOT NULL,
  dam VARCHAR(255) NOT NULL,
  sex VARCHAR(20) NOT NULL CHECK (sex IN ('colt', 'filly', 'gelding', 'mare', 'stallion')),
  age INTEGER NOT NULL CHECK (age > 0),
  age_category VARCHAR(10) NOT NULL CHECK (age_category IN ('1YO', '2YO', '3YO', '4YO', '5YO', '6YO', '7YO', '8YO+')),
  gait VARCHAR(20) NOT NULL CHECK (gait IN ('trotter', 'pacer')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('new', 'old')),
  horse_type VARCHAR(50) NOT NULL CHECK (horse_type IN ('standardbred', 'thoroughbred', 'quarter_horse', 'arabian', 'other')),
  jurisdiction TEXT[] NOT NULL DEFAULT '{}',
  trainer VARCHAR(255),
  stable_location VARCHAR(255),
  purchase_date DATE NOT NULL,
  purchase_price DECIMAL(12,2) NOT NULL CHECK (purchase_price >= 0),
  current_value DECIMAL(12,2) CHECK (current_value >= 0),
  price_per_percent DECIMAL(8,2) NOT NULL CHECK (price_per_percent >= 0),
  initial_shares INTEGER NOT NULL DEFAULT 100 CHECK (initial_shares > 0),
  current_shares INTEGER NOT NULL DEFAULT 100 CHECK (current_shares >= 0 AND current_shares <= initial_shares),
  shares_remaining INTEGER NOT NULL DEFAULT 100 CHECK (shares_remaining >= 0),
  wins INTEGER DEFAULT 0 CHECK (wins >= 0),
  places INTEGER DEFAULT 0 CHECK (places >= 0),
  shows INTEGER DEFAULT 0 CHECK (shows >= 0),
  races INTEGER DEFAULT 0 CHECK (races >= 0),
  earnings DECIMAL(12,2) DEFAULT 0 CHECK (earnings >= 0),
  image_url VARCHAR(500),
  description TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create horse_ownership table for tracking ownership
CREATE TABLE horse_ownership (
  id SERIAL PRIMARY KEY,
  horse_id INTEGER NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  purchase_date TIMESTAMP NOT NULL,
  purchase_price DECIMAL(12,2) NOT NULL CHECK (purchase_price >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(horse_id, member_id, is_active)
);

-- Create horse_transactions table for tracking all horse-related transactions
CREATE TABLE horse_transactions (
  id SERIAL PRIMARY KEY,
  horse_id INTEGER NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'sale', 'transfer')),
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage > 0),
  price_per_percent DECIMAL(8,2) NOT NULL CHECK (price_per_percent >= 0),
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
  transaction_date TIMESTAMP NOT NULL,
  notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create horse_performance_updates table for tracking performance changes
CREATE TABLE horse_performance_updates (
  id SERIAL PRIMARY KEY,
  horse_id INTEGER NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  wins INTEGER DEFAULT 0 CHECK (wins >= 0),
  places INTEGER DEFAULT 0 CHECK (places >= 0),
  shows INTEGER DEFAULT 0 CHECK (shows >= 0),
  races INTEGER DEFAULT 0 CHECK (races >= 0),
  earnings DECIMAL(12,2) DEFAULT 0 CHECK (earnings >= 0),
  update_date DATE NOT NULL,
  notes TEXT,
  updated_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create horse_financial_updates table for tracking financial changes
CREATE TABLE horse_financial_updates (
  id SERIAL PRIMARY KEY,
  horse_id INTEGER NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  current_value DECIMAL(12,2) CHECK (current_value >= 0),
  price_per_percent DECIMAL(8,2) CHECK (price_per_percent >= 0),
  shares_remaining INTEGER CHECK (shares_remaining >= 0),
  update_date DATE NOT NULL,
  notes TEXT,
  updated_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_horses_name ON horses(name);
CREATE INDEX idx_horses_sire ON horses(sire);
CREATE INDEX idx_horses_dam ON horses(dam);
CREATE INDEX idx_horses_status ON horses(status);
CREATE INDEX idx_horses_age ON horses(age);
CREATE INDEX idx_horses_gait ON horses(gait);
CREATE INDEX idx_horses_horse_type ON horses(horse_type);
CREATE INDEX idx_horses_trainer ON horses(trainer);
CREATE INDEX idx_horses_purchase_date ON horses(purchase_date);
CREATE INDEX idx_horses_created_by ON horses(created_by);
CREATE INDEX idx_horses_updated_by ON horses(updated_by);

CREATE INDEX idx_horse_ownership_horse_id ON horse_ownership(horse_id);
CREATE INDEX idx_horse_ownership_member_id ON horse_ownership(member_id);
CREATE INDEX idx_horse_ownership_purchase_date ON horse_ownership(purchase_date);
CREATE INDEX idx_horse_ownership_is_active ON horse_ownership(is_active);

CREATE INDEX idx_horse_transactions_horse_id ON horse_transactions(horse_id);
CREATE INDEX idx_horse_transactions_member_id ON horse_transactions(member_id);
CREATE INDEX idx_horse_transactions_type ON horse_transactions(transaction_type);
CREATE INDEX idx_horse_transactions_date ON horse_transactions(transaction_date);

CREATE INDEX idx_horse_performance_horse_id ON horse_performance_updates(horse_id);
CREATE INDEX idx_horse_performance_date ON horse_performance_updates(update_date);

CREATE INDEX idx_horse_financial_horse_id ON horse_financial_updates(horse_id);
CREATE INDEX idx_horse_financial_date ON horse_financial_updates(update_date);

-- Create updated_at triggers
CREATE TRIGGER update_horses_updated_at 
  BEFORE UPDATE ON horses 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_horse_ownership_updated_at 
  BEFORE UPDATE ON horse_ownership 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to update shares_remaining when ownership changes
CREATE OR REPLACE FUNCTION update_horse_shares_remaining()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total owned percentage for the horse
  UPDATE horses 
  SET shares_remaining = 100 - COALESCE(
    (SELECT SUM(percentage) 
     FROM horse_ownership 
     WHERE horse_id = COALESCE(NEW.horse_id, OLD.horse_id) 
     AND is_active = true), 0
  )
  WHERE id = COALESCE(NEW.horse_id, OLD.horse_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Create triggers to update shares_remaining
CREATE TRIGGER update_shares_on_ownership_change
  AFTER INSERT OR UPDATE OR DELETE ON horse_ownership
  FOR EACH ROW EXECUTE FUNCTION update_horse_shares_remaining();

-- Sample horses will be inserted via seed script after users are created
