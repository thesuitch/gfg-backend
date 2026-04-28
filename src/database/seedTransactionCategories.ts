import { PoolClient } from 'pg';
import { logger } from '../utils/logger';

/**
 * Canonical GFG transaction categories (revenue → expenses → adjustments).
 * Idempotent upsert — run via `npm run seed` or `npm run seed:categories`.
 */
const DEFAULT_CATEGORIES = [
  {
    id: 'rev1',
    name: 'Gross Revenue',
    type: 'revenue' as const,
    group: 'revenue' as const,
    allowsNegative: false,
    sortOrder: 1,
    description: 'Income generated from purses earned from racing',
  },
  {
    id: 'rev2',
    name: 'Gain on Sale',
    type: 'revenue' as const,
    group: 'revenue' as const,
    allowsNegative: false,
    sortOrder: 2,
    description: 'Proceeds from sale of horses',
  },
  {
    id: 'rev3',
    name: 'Driver/Trainer & NY Starter Fees',
    type: 'revenue' as const,
    group: 'revenue' as const,
    allowsNegative: true,
    sortOrder: 3,
    description: '5% commission to Trainer and 5% to Driver from purses and NY Starter Fees per NY race',
  },
  {
    id: 'rev4',
    name: 'Net Purses',
    type: 'revenue' as const,
    group: 'revenue' as const,
    allowsNegative: false,
    sortOrder: 4,
    description: 'Net purses after commission',
  },
  {
    id: 'exp2',
    name: 'Training',
    type: 'expense' as const,
    group: 'expense' as const,
    allowsNegative: false,
    sortOrder: 5,
    description: 'Training expenses for horses',
  },
  {
    id: 'exp3',
    name: 'Turn Out / Paddock',
    type: 'expense' as const,
    group: 'expense' as const,
    allowsNegative: false,
    sortOrder: 6,
    description: 'Turn out / paddock expenses',
  },
  {
    id: 'exp4',
    name: 'Stall Rent',
    type: 'expense' as const,
    group: 'expense' as const,
    allowsNegative: false,
    sortOrder: 7,
    description: 'Stall rent expenses',
  },
  {
    id: 'exp5',
    name: 'Blacksmith / Farrier',
    type: 'expense' as const,
    group: 'expense' as const,
    allowsNegative: false,
    sortOrder: 8,
    description: 'Farrier expenses',
  },
  {
    id: 'exp6',
    name: 'Miscellaneous',
    type: 'expense' as const,
    group: 'expense' as const,
    allowsNegative: false,
    sortOrder: 9,
    description: 'Misc horse-related expenses',
  },
  {
    id: 'exp7',
    name: 'Veterinary & Treatment',
    type: 'expense' as const,
    group: 'expense' as const,
    allowsNegative: false,
    sortOrder: 10,
    description: 'Vet and treatment expenses',
  },
  {
    id: 'exp8',
    name: 'Stakes Fees & Stakes Starter Fee',
    type: 'expense' as const,
    group: 'expense' as const,
    allowsNegative: false,
    sortOrder: 11,
    description: 'Stakes-related fees',
  },
  {
    id: 'exp9',
    name: 'Race Expenses',
    type: 'expense' as const,
    group: 'expense' as const,
    allowsNegative: false,
    sortOrder: 12,
    description: 'Race-related expenses',
  },
  {
    id: 'exp10',
    name: 'Shipping',
    type: 'expense' as const,
    group: 'expense' as const,
    allowsNegative: false,
    sortOrder: 13,
    description: 'Fees to ship horses',
  },
  {
    id: 'adj1',
    name: 'GFG Billing Adjustments or Corrections',
    type: 'adjustment' as const,
    group: 'adjustment' as const,
    allowsNegative: true,
    sortOrder: 14,
    description: 'Manual billing adjustments',
  },
  {
    id: 'adj2',
    name: 'GFG Gear Purchase',
    type: 'adjustment' as const,
    group: 'adjustment' as const,
    allowsNegative: true,
    sortOrder: 15,
    description: 'GFG gear purchases',
  },
];

/** Check if transaction_categories has description and is_core columns (migration 006). */
async function hasDescriptionAndIsCore(client: PoolClient): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'transaction_categories' AND column_name = 'description'
     LIMIT 1`
  );
  const hasDesc = r.rows.length > 0;
  const r2 = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'transaction_categories' AND column_name = 'is_core'
     LIMIT 1`
  );
  return hasDesc && r2.rows.length > 0;
}

/** Check if transaction_categories has signage column (migration 007). */
async function hasSignage(client: PoolClient): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'transaction_categories' AND column_name = 'signage'
     LIMIT 1`
  );
  return r.rows.length > 0;
}

function signageForCategory(cat: (typeof DEFAULT_CATEGORIES)[0]): string {
  if (cat.allowsNegative) return 'both';
  if (cat.type === 'expense') return 'negative';
  return 'positive';
}

export async function seedTransactionCategories(client: PoolClient): Promise<void> {
  logger.info('Seeding transaction categories...');

  const hasExtraColumns = await hasDescriptionAndIsCore(client);
  const hasSignageCol = await hasSignage(client);

  if (hasExtraColumns) {
    for (const cat of DEFAULT_CATEGORIES) {
      const signage = hasSignageCol ? signageForCategory(cat) : cat.allowsNegative ? 'both' : 'positive';
      if (hasSignageCol) {
        await client.query(
          `INSERT INTO transaction_categories (id, name, type, group_name, allows_negative, sort_order, description, is_core, signage)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             type = EXCLUDED.type,
             group_name = EXCLUDED.group_name,
             allows_negative = EXCLUDED.allows_negative,
             sort_order = EXCLUDED.sort_order,
             description = EXCLUDED.description,
             is_core = EXCLUDED.is_core,
             signage = EXCLUDED.signage`,
          [cat.id, cat.name, cat.type, cat.group, cat.allowsNegative, cat.sortOrder, cat.description ?? null, signage]
        );
      } else {
        await client.query(
          `INSERT INTO transaction_categories (id, name, type, group_name, allows_negative, sort_order, description, is_core)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             type = EXCLUDED.type,
             group_name = EXCLUDED.group_name,
             allows_negative = EXCLUDED.allows_negative,
             sort_order = EXCLUDED.sort_order,
             description = EXCLUDED.description,
             is_core = EXCLUDED.is_core`,
          [cat.id, cat.name, cat.type, cat.group, cat.allowsNegative, cat.sortOrder, cat.description ?? null]
        );
      }
    }
  } else {
    for (const cat of DEFAULT_CATEGORIES) {
      await client.query(
        `INSERT INTO transaction_categories (id, name, type, group_name, allows_negative, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           type = EXCLUDED.type,
           group_name = EXCLUDED.group_name,
           allows_negative = EXCLUDED.allows_negative,
           sort_order = EXCLUDED.sort_order`,
        [cat.id, cat.name, cat.type, cat.group, cat.allowsNegative, cat.sortOrder]
      );
    }
    logger.info('Run "npm run migrate" to add description/is_core columns, then re-run seed for full data.');
  }

  logger.info(`✅ Transaction categories seeded (${DEFAULT_CATEGORIES.length} categories)`);
}
