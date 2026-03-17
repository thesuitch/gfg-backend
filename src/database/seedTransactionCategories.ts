import { PoolClient } from 'pg';
import { logger } from '../utils/logger';

/** Default transaction categories (same as migration 005 + descriptions). Idempotent upsert. */
const DEFAULT_CATEGORIES = [
  { id: 'rev1', name: 'Gross Revenue', type: 'revenue', group: 'revenue', allowsNegative: false, sortOrder: 1, description: 'Income from race winnings and performance' },
  { id: 'rev2', name: 'Gain on Sale', type: 'revenue', group: 'revenue', allowsNegative: false, sortOrder: 2, description: 'Profit from selling horse shares or horses' },
  { id: 'rev3', name: 'Driver/Trainer & NY Starter Fees', type: 'revenue', group: 'revenue', allowsNegative: true, sortOrder: 3, description: 'Fees paid to drivers, trainers, and starter fees' },
  { id: 'exp2', name: 'Training', type: 'expense', group: 'expense', allowsNegative: false, sortOrder: 4, description: 'Regular training costs and related expenses' },
  { id: 'exp3', name: 'Turn Out / Paddock', type: 'expense', group: 'expense', allowsNegative: false, sortOrder: 5, description: 'Costs for paddock use and turnout services' },
  { id: 'exp4', name: 'Stall Rent', type: 'expense', group: 'expense', allowsNegative: false, sortOrder: 6, description: 'Monthly stall rental fees' },
  { id: 'exp5', name: 'Blacksmith / Farrier', type: 'expense', group: 'expense', allowsNegative: false, sortOrder: 7, description: 'Horseshoeing and hoof care services' },
  { id: 'exp6', name: 'Miscellaneous', type: 'expense', group: 'expense', allowsNegative: false, sortOrder: 8, description: 'Barn supplies, groom bonuses, insurance, etc.' },
  { id: 'exp7', name: 'Veterinary & Treatment', type: 'expense', group: 'expense', allowsNegative: false, sortOrder: 9, description: 'Medical care and veterinary services' },
  { id: 'exp8', name: 'Stakes Fees & Stakes Starter Fee', type: 'expense', group: 'expense', allowsNegative: false, sortOrder: 10, description: 'Entry fees for stakes races' },
  { id: 'exp9', name: 'Race (Paddock, Shipping, Lasix, etc.)', type: 'expense', group: 'expense', allowsNegative: false, sortOrder: 11, description: 'Race day expenses including shipping and medications' },
  { id: 'adj1', name: 'GFG Billing Adjustments or Corrections', type: 'adjustment', group: 'adjustment', allowsNegative: true, sortOrder: 12, description: 'Administrative adjustments and billing corrections' },
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

export async function seedTransactionCategories(client: PoolClient): Promise<void> {
  logger.info('Seeding transaction categories...');

  const hasExtraColumns = await hasDescriptionAndIsCore(client);
  const hasSignageCol = await hasSignage(client);

  if (hasExtraColumns) {
    for (const cat of DEFAULT_CATEGORIES) {
      const signage = cat.allowsNegative ? 'both' : 'positive';
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
