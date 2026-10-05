-- Monthly member statements / invoices with line items.

CREATE TABLE IF NOT EXISTS member_statements (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  invoice_number VARCHAR(40) NOT NULL UNIQUE,
  generated_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_expenses DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP,
  paid_by INTEGER REFERENCES users(id),
  generated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (member_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_member_statements_member ON member_statements(member_id);
CREATE INDEX IF NOT EXISTS idx_member_statements_period ON member_statements(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_member_statements_paid ON member_statements(is_paid);

CREATE TABLE IF NOT EXISTS member_statement_lines (
  id SERIAL PRIMARY KEY,
  statement_id INTEGER NOT NULL REFERENCES member_statements(id) ON DELETE CASCADE,
  line_date DATE NOT NULL,
  horse_id INTEGER REFERENCES horses(id) ON DELETE SET NULL,
  horse_name VARCHAR(255),
  description TEXT NOT NULL,
  category VARCHAR(80) NOT NULL,
  line_type VARCHAR(20) NOT NULL CHECK (line_type IN ('revenue', 'expense', 'adjustment')),
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  affects_balance BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_member_statement_lines_statement ON member_statement_lines(statement_id);
CREATE INDEX IF NOT EXISTS idx_member_statement_lines_horse ON member_statement_lines(horse_id);

CREATE TRIGGER update_member_statements_updated_at
  BEFORE UPDATE ON member_statements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
