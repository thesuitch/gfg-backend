-- Filter settings (jurisdictions, sires, trainers, horse types).
-- Option IDs are unique per filter_type (same numeric id may exist across types).

CREATE TABLE IF NOT EXISTS filter_options (
  id VARCHAR(64) NOT NULL,
  filter_type VARCHAR(20) NOT NULL CHECK (filter_type IN ('jurisdiction', 'sire', 'trainer', 'horseType')),
  value VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (filter_type, id),
  UNIQUE (filter_type, value)
);

CREATE INDEX IF NOT EXISTS idx_filter_options_type ON filter_options(filter_type);
CREATE INDEX IF NOT EXISTS idx_filter_options_type_active ON filter_options(filter_type, is_active);

INSERT INTO filter_options (id, filter_type, value, label, is_active, sort_order, created_at, updated_at) VALUES
  ('1', 'jurisdiction', 'NY', 'NY', true, 1, '2024-01-01', '2024-01-01'),
  ('2', 'jurisdiction', 'NJ', 'NJ', true, 2, '2024-01-01', '2024-01-01'),
  ('3', 'jurisdiction', 'MA', 'MA', true, 3, '2024-01-01', '2024-01-01'),
  ('4', 'jurisdiction', 'PA', 'PA', true, 4, '2024-01-01', '2024-01-01'),
  ('5', 'jurisdiction', 'IN', 'IN', true, 5, '2024-01-01', '2024-01-01'),
  ('6', 'jurisdiction', 'OH', 'OH', true, 6, '2024-01-01', '2024-01-01'),
  ('7', 'jurisdiction', 'KY', 'KY', true, 7, '2024-01-01', '2024-01-01'),
  ('8', 'jurisdiction', 'ON', 'ON', true, 8, '2024-01-01', '2024-01-01'),
  ('9', 'jurisdiction', 'PA-MA', 'PA-MA', true, 9, '2024-01-01', '2024-01-01'),
  ('10', 'jurisdiction', 'NJ-MA', 'NJ-MA', true, 10, '2024-01-01', '2024-01-01'),
  ('11', 'jurisdiction', 'NY-MA', 'NY-MA', true, 11, '2024-01-01', '2024-01-01')
ON CONFLICT (filter_type, id) DO NOTHING;

INSERT INTO filter_options (id, filter_type, value, label, is_active, sort_order, created_at, updated_at) VALUES
  ('1', 'sire', 'Captain Corey', 'Captain Corey', true, 1, '2024-01-01', '2024-01-01'),
  ('2', 'sire', 'Chapter Seven', 'Chapter Seven', true, 2, '2024-01-01', '2024-01-01'),
  ('3', 'sire', 'EL Titan', 'EL Titan', true, 3, '2024-01-01', '2024-01-01'),
  ('4', 'sire', 'Walner', 'Walner', true, 4, '2024-01-01', '2024-01-01'),
  ('5', 'sire', 'Sweet Lou', 'Sweet Lou', true, 5, '2024-01-01', '2024-01-01'),
  ('6', 'sire', 'Resolve', 'Resolve', true, 6, '2024-01-01', '2024-01-01'),
  ('7', 'sire', 'Check Six', 'Check Six', true, 7, '2024-01-01', '2024-01-01'),
  ('8', 'sire', 'Artspeak', 'Artspeak', true, 8, '2024-01-01', '2024-01-01'),
  ('9', 'sire', 'Captaintreacherous', 'Captaintreacherous', true, 9, '2024-01-01', '2024-01-01'),
  ('10', 'sire', 'Luck Be Withyou', 'Luck Be Withyou', true, 10, '2024-01-01', '2024-01-01'),
  ('11', 'sire', 'Six Pack', 'Six Pack', true, 11, '2024-01-01', '2024-01-01'),
  ('12', 'sire', 'Mets Hall', 'Mets Hall', true, 12, '2024-01-01', '2024-01-01'),
  ('13', 'sire', 'International Moni', 'International Moni', true, 13, '2024-01-01', '2024-01-01'),
  ('14', 'sire', 'Crazy Wow', 'Crazy Wow', true, 14, '2024-01-01', '2024-01-01'),
  ('15', 'sire', 'Huntsville', 'Huntsville', true, 15, '2024-01-01', '2024-01-01'),
  ('16', 'sire', 'What The Hill', 'What The Hill', true, 16, '2024-01-01', '2024-01-01'),
  ('17', 'sire', 'Back Of The Neck', 'Back Of The Neck', true, 17, '2024-01-01', '2024-01-01'),
  ('18', 'sire', 'Lazarus', 'Lazarus', true, 18, '2024-01-01', '2024-01-01'),
  ('19', 'sire', 'Golden Arrow', 'Golden Arrow', true, 19, '2024-01-01', '2024-01-01'),
  ('20', 'sire', 'Silver Storm', 'Silver Storm', true, 20, '2024-01-01', '2024-01-01'),
  ('21', 'sire', 'Express Lane', 'Express Lane', true, 21, '2024-01-01', '2024-01-01')
ON CONFLICT (filter_type, id) DO NOTHING;

INSERT INTO filter_options (id, filter_type, value, label, is_active, sort_order, created_at, updated_at) VALUES
  ('1', 'trainer', 'Paul Kelley', 'Paul Kelley', true, 1, '2024-01-01', '2024-01-01'),
  ('2', 'trainer', 'Rob Harmon', 'Rob Harmon', true, 2, '2024-01-01', '2024-01-01')
ON CONFLICT (filter_type, id) DO NOTHING;

INSERT INTO filter_options (id, filter_type, value, label, is_active, sort_order, created_at, updated_at) VALUES
  ('1', 'horseType', 'Yearling/Baby', 'Yearling/Baby', true, 1, '2024-01-01', '2024-01-01'),
  ('2', 'horseType', 'Stakes Racehorse', 'Stakes Racehorse', true, 2, '2024-01-01', '2024-01-01'),
  ('3', 'horseType', 'Conditioned Racehorse', 'Conditioned Racehorse', true, 3, '2024-01-01', '2024-01-01'),
  ('4', 'horseType', 'Broodmare', 'Broodmare', true, 4, '2024-01-01', '2024-01-01')
ON CONFLICT (filter_type, id) DO NOTHING;
