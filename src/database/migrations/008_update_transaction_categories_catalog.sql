-- Align transaction_categories with GFG canonical catalog (names, descriptions, sort_order).
-- Adds: rev4 Net Purses, exp10 Shipping, adj2 GFG Gear Purchase.
--
-- Prerequisite: run 006_add_category_description_and_is_core.sql and
-- 007_add_category_signage.sql first (this file updates/inserts `signage` and `description`).

UPDATE transaction_categories SET
  name = 'Gross Revenue',
  description = 'Income generated from purses earned from racing',
  sort_order = 1,
  type = 'revenue',
  group_name = 'revenue',
  allows_negative = false,
  is_core = true,
  signage = 'positive'
WHERE id = 'rev1';

UPDATE transaction_categories SET
  name = 'Gain on Sale',
  description = 'Proceeds from sale of horses',
  sort_order = 2,
  type = 'revenue',
  group_name = 'revenue',
  allows_negative = false,
  is_core = true,
  signage = 'positive'
WHERE id = 'rev2';

UPDATE transaction_categories SET
  name = 'Driver/Trainer & NY Starter Fees',
  description = '5% commission to Trainer and 5% to Driver from purses and NY Starter Fees per NY race',
  sort_order = 3,
  type = 'revenue',
  group_name = 'revenue',
  allows_negative = true,
  is_core = true,
  signage = 'both'
WHERE id = 'rev3';

UPDATE transaction_categories SET
  name = 'Training',
  description = 'Training expenses for horses',
  sort_order = 5,
  type = 'expense',
  group_name = 'expense',
  allows_negative = false,
  is_core = true,
  signage = 'negative'
WHERE id = 'exp2';

UPDATE transaction_categories SET
  name = 'Turn Out / Paddock',
  description = 'Turn out / paddock expenses',
  sort_order = 6,
  type = 'expense',
  group_name = 'expense',
  allows_negative = false,
  is_core = true,
  signage = 'negative'
WHERE id = 'exp3';

UPDATE transaction_categories SET
  name = 'Stall Rent',
  description = 'Stall rent expenses',
  sort_order = 7,
  type = 'expense',
  group_name = 'expense',
  allows_negative = false,
  is_core = true,
  signage = 'negative'
WHERE id = 'exp4';

UPDATE transaction_categories SET
  name = 'Blacksmith / Farrier',
  description = 'Farrier expenses',
  sort_order = 8,
  type = 'expense',
  group_name = 'expense',
  allows_negative = false,
  is_core = true,
  signage = 'negative'
WHERE id = 'exp5';

UPDATE transaction_categories SET
  name = 'Miscellaneous',
  description = 'Misc horse-related expenses',
  sort_order = 9,
  type = 'expense',
  group_name = 'expense',
  allows_negative = false,
  is_core = true,
  signage = 'negative'
WHERE id = 'exp6';

UPDATE transaction_categories SET
  name = 'Veterinary & Treatment',
  description = 'Vet and treatment expenses',
  sort_order = 10,
  type = 'expense',
  group_name = 'expense',
  allows_negative = false,
  is_core = true,
  signage = 'negative'
WHERE id = 'exp7';

UPDATE transaction_categories SET
  name = 'Stakes Fees & Stakes Starter Fee',
  description = 'Stakes-related fees',
  sort_order = 11,
  type = 'expense',
  group_name = 'expense',
  allows_negative = false,
  is_core = true,
  signage = 'negative'
WHERE id = 'exp8';

UPDATE transaction_categories SET
  name = 'Race Expenses',
  description = 'Race-related expenses',
  sort_order = 12,
  type = 'expense',
  group_name = 'expense',
  allows_negative = false,
  is_core = true,
  signage = 'negative'
WHERE id = 'exp9';

UPDATE transaction_categories SET
  name = 'GFG Billing Adjustments or Corrections',
  description = 'Manual billing adjustments',
  sort_order = 14,
  type = 'adjustment',
  group_name = 'adjustment',
  allows_negative = true,
  is_core = true,
  signage = 'both'
WHERE id = 'adj1';

INSERT INTO transaction_categories (id, name, type, group_name, allows_negative, sort_order, description, is_core, signage)
VALUES
  ('rev4', 'Net Purses', 'revenue', 'revenue', false, 4,
   'Net purses after commission', true, 'positive'),
  ('exp10', 'Shipping', 'expense', 'expense', false, 13, 'Fees to ship horses', true, 'negative'),
  ('adj2', 'GFG Gear Purchase', 'adjustment', 'adjustment', true, 15, 'GFG gear purchases', true, 'both')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  group_name = EXCLUDED.group_name,
  allows_negative = EXCLUDED.allows_negative,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description,
  is_core = EXCLUDED.is_core,
  signage = EXCLUDED.signage;
