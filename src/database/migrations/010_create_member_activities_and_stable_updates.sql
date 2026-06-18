-- Member activity ledger (Member Transactions)
CREATE TABLE member_activities (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'direct_purchase', 'direct_sale', 'marketplace_purchase', 'marketplace_sale',
    'deposit', 'withdrawal', 'adjustment', 'prior_balance',
    'online_service_fee', 'marketplace_processing_fee'
  )),
  horse_id INTEGER REFERENCES horses(id) ON DELETE SET NULL,
  activity_date DATE NOT NULL,
  percentage DECIMAL(8,2),
  amount DECIMAL(12,2) NOT NULL,
  fee DECIMAL(12,2),
  notes TEXT,
  source VARCHAR(30) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'purchase_api', 'marketplace')),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_member_activities_member_id ON member_activities(member_id);
CREATE INDEX idx_member_activities_horse_id ON member_activities(horse_id);
CREATE INDEX idx_member_activities_activity_date ON member_activities(activity_date);
CREATE INDEX idx_member_activities_activity_type ON member_activities(activity_type);

-- Stable updates (Updates Manager)
CREATE TABLE stable_updates (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('news', 'activity')),
  horse_id INTEGER REFERENCES horses(id) ON DELETE SET NULL,
  is_general BOOLEAN NOT NULL DEFAULT false,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stable_updates_horse_id ON stable_updates(horse_id);
CREATE INDEX idx_stable_updates_created_at ON stable_updates(created_at);
CREATE INDEX idx_stable_updates_is_general ON stable_updates(is_general);
