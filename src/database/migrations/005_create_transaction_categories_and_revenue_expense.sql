-- Migration: transaction_categories and horse_revenue_expense (Horse Revenue & Expense)
-- Supports Admin Horse Revenue & Expense financial items per horse per day.

-- Transaction categories (revenue/expense/adjustment) - master data
CREATE TABLE transaction_categories (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('revenue', 'expense', 'adjustment')),
  group_name VARCHAR(20) NOT NULL CHECK (group_name IN ('revenue', 'expense', 'adjustment')),
  allows_negative BOOLEAN DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Horse revenue/expense line items (one row per horse per category per date)
CREATE TABLE horse_revenue_expense (
  id SERIAL PRIMARY KEY,
  horse_id INTEGER NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  category_id VARCHAR(20) NOT NULL REFERENCES transaction_categories(id) ON DELETE RESTRICT,
  transaction_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_horse_revenue_expense_horse_id ON horse_revenue_expense(horse_id);
CREATE INDEX idx_horse_revenue_expense_category_id ON horse_revenue_expense(category_id);
CREATE INDEX idx_horse_revenue_expense_transaction_date ON horse_revenue_expense(transaction_date);
CREATE INDEX idx_horse_revenue_expense_created_at ON horse_revenue_expense(created_at);

-- Seed default categories (match frontend transactionCategoriesForAdmin)
INSERT INTO transaction_categories (id, name, type, group_name, allows_negative, sort_order) VALUES
  ('rev1', 'Gross Revenue', 'revenue', 'revenue', false, 1),
  ('rev2', 'Gain on Sale', 'revenue', 'revenue', false, 2),
  ('rev3', 'Driver/Trainer & NY Starter Fees', 'revenue', 'revenue', true, 3),
  ('exp2', 'Training', 'expense', 'expense', false, 4),
  ('exp3', 'Turn Out / Paddock', 'expense', 'expense', false, 5),
  ('exp4', 'Stall Rent', 'expense', 'expense', false, 6),
  ('exp5', 'Blacksmith / Farrier', 'expense', 'expense', false, 7),
  ('exp6', 'Miscellaneous', 'expense', 'expense', false, 8),
  ('exp7', 'Veterinary & Treatment', 'expense', 'expense', false, 9),
  ('exp8', 'Stakes Fees & Stakes Starter Fee', 'expense', 'expense', false, 10),
  ('exp9', 'Race Expenses', 'expense', 'expense', false, 11),
  ('adj1', 'GFG Billing Adjustments or Corrections', 'adjustment', 'adjustment', true, 12);

-- Trigger for transaction_categories updated_at (reuse existing function)
CREATE TRIGGER update_transaction_categories_updated_at
  BEFORE UPDATE ON transaction_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
