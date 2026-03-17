import { Pool } from 'pg';
import {
  TransactionCategory,
  HorseRevenueExpenseItem,
  TransactionFilters,
  AddTransactionItem,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../types/transaction';
import { logger } from '../utils/logger';

function categoryRowMap(row: any): TransactionCategory {
  const allowsNegative = row.allowsNegative ?? row.allows_negative ?? false;
  const signage = row.signage ?? (allowsNegative ? 'both' : 'positive');
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    group: row.groupName ?? row.group_name,
    allowsNegative,
    description: row.description ?? null,
    isCore: row.isCore ?? row.is_core ?? false,
    signage: signage as 'positive' | 'negative' | 'both',
  };
}

const CATEGORIES_SELECT_MINIMAL = `SELECT id, name, type, group_name as "groupName", allows_negative as "allowsNegative"
 FROM transaction_categories ORDER BY sort_order, id`;
const CATEGORIES_SELECT_FULL = `SELECT id, name, type, group_name as "groupName", allows_negative as "allowsNegative", description, is_core as "isCore", signage
 FROM transaction_categories ORDER BY sort_order, id`;

export class TransactionService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getCategories(): Promise<TransactionCategory[]> {
    try {
      const result = await this.pool.query(CATEGORIES_SELECT_FULL);
      return result.rows.map((row: any) => categoryRowMap(row));
    } catch (err: any) {
      if (err?.code === '42703') {
        const result = await this.pool.query(CATEGORIES_SELECT_MINIMAL);
        return result.rows.map((row: any) => categoryRowMap(row));
      }
      throw err;
    }
  }

  async createCategory(input: CreateCategoryInput): Promise<TransactionCategory> {
    const sortOrderResult = await this.pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM transaction_categories'
    );
    const sortOrder = sortOrderResult.rows[0]?.next_order ?? 1;
    const groupName = input.type;

    const signage = input.signage ?? (input.allowsNegative ? 'both' : 'positive');
    const allowsNegative = signage === 'both' || signage === 'negative';

    try {
      const result = await this.pool.query(
        `INSERT INTO transaction_categories (id, name, type, group_name, allows_negative, sort_order, description, is_core, signage)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
         RETURNING id, name, type, group_name as "groupName", allows_negative as "allowsNegative", description, is_core as "isCore", signage`,
        [
          input.id,
          input.name,
          input.type,
          groupName,
          allowsNegative,
          sortOrder,
          input.description ?? null,
          signage,
        ]
      );
      return categoryRowMap(result.rows[0]);
    } catch (err: any) {
      if (err?.code === '42703') {
        const result = await this.pool.query(
          `INSERT INTO transaction_categories (id, name, type, group_name, allows_negative, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, name, type, group_name as "groupName", allows_negative as "allowsNegative"`,
          [input.id, input.name, input.type, groupName, allowsNegative, sortOrder]
        );
        return categoryRowMap(result.rows[0]);
      }
      throw err;
    }
  }

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<TransactionCategory | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(input.type);
      updates.push(`group_name = $${paramIndex++}`);
      values.push(input.type);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description || null);
    }
    if (input.signage !== undefined) {
      updates.push(`signage = $${paramIndex++}`);
      values.push(input.signage);
      updates.push(`allows_negative = $${paramIndex++}`);
      values.push(input.signage === 'both' || input.signage === 'negative');
    } else if (input.allowsNegative !== undefined) {
      updates.push(`allows_negative = $${paramIndex++}`);
      values.push(input.allowsNegative);
    }

    if (updates.length === 0) return this.getCategoryById(id);

    values.push(id);
    try {
      const result = await this.pool.query(
        `UPDATE transaction_categories SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, name, type, group_name as "groupName", allows_negative as "allowsNegative", description, is_core as "isCore", signage`,
        values
      );
      if (result.rows.length === 0) return null;
      return categoryRowMap(result.rows[0]);
    } catch (err: any) {
      if (err?.code === '42703') {
        const minimalUpdates: string[] = [];
        const minimalValues: any[] = [];
        let p = 1;
        if (input.name !== undefined) {
          minimalUpdates.push(`name = $${p++}`);
          minimalValues.push(input.name);
        }
        if (input.type !== undefined) {
          minimalUpdates.push(`type = $${p++}`);
          minimalValues.push(input.type);
          minimalUpdates.push(`group_name = $${p++}`);
          minimalValues.push(input.type);
        }
        if (input.allowsNegative !== undefined) {
          minimalUpdates.push(`allows_negative = $${p++}`);
          minimalValues.push(input.allowsNegative);
        }
        if (input.signage !== undefined) {
          minimalUpdates.push(`allows_negative = $${p++}`);
          minimalValues.push(input.signage === 'both' || input.signage === 'negative');
        }
        if (minimalUpdates.length === 0) return this.getCategoryById(id);
        minimalValues.push(id);
        const result = await this.pool.query(
          `UPDATE transaction_categories SET ${minimalUpdates.join(', ')} WHERE id = $${p}
           RETURNING id, name, type, group_name as "groupName", allows_negative as "allowsNegative"`,
          minimalValues
        );
        if (result.rows.length === 0) return null;
        return categoryRowMap(result.rows[0]);
      }
      throw err;
    }
  }

  async getCategoryById(id: string): Promise<TransactionCategory | null> {
    try {
      const result = await this.pool.query(
        `SELECT id, name, type, group_name as "groupName", allows_negative as "allowsNegative", description, is_core as "isCore", signage
         FROM transaction_categories WHERE id = $1`,
        [id]
      );
      if (result.rows.length === 0) return null;
      return categoryRowMap(result.rows[0]);
    } catch (err: any) {
      if (err?.code === '42703') {
        const result = await this.pool.query(
          `SELECT id, name, type, group_name as "groupName", allows_negative as "allowsNegative"
           FROM transaction_categories WHERE id = $1`,
          [id]
        );
        if (result.rows.length === 0) return null;
        return categoryRowMap(result.rows[0]);
      }
      throw err;
    }
  }

  async deleteCategory(id: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'DELETE FROM transaction_categories WHERE id = $1 AND is_core = false RETURNING id',
        [id]
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch (err: any) {
      if (err?.code === '42703') {
        const result = await this.pool.query(
          'DELETE FROM transaction_categories WHERE id = $1 RETURNING id',
          [id]
        );
        return result.rowCount !== null && result.rowCount > 0;
      }
      throw err;
    }
  }

  async getTransactions(filters: TransactionFilters = {}): Promise<HorseRevenueExpenseItem[]> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.horseId) {
      conditions.push(`hre.horse_id = $${paramIndex}`);
      params.push(filters.horseId);
      paramIndex++;
    }
    if (filters.categoryId) {
      conditions.push(`hre.category_id = $${paramIndex}`);
      params.push(filters.categoryId);
      paramIndex++;
    }
    if (filters.type) {
      conditions.push(`tc.type = $${paramIndex}`);
      params.push(filters.type);
      paramIndex++;
    }
    if (filters.dateFrom) {
      conditions.push(`hre.transaction_date >= $${paramIndex}`);
      params.push(filters.dateFrom);
      paramIndex++;
    }
    if (filters.dateTo) {
      conditions.push(`hre.transaction_date <= $${paramIndex}`);
      params.push(filters.dateTo);
      paramIndex++;
    }

    const query = `
      SELECT
        hre.id,
        hre.transaction_date as date,
        hre.horse_id as "horseId",
        h.name as "horseName",
        hre.category_id as "categoryId",
        tc.name as "categoryName",
        tc.type as "categoryType",
        tc.group_name as "categoryGroup",
        hre.amount,
        COALESCE(hre.notes, '') as notes
      FROM horse_revenue_expense hre
      JOIN horses h ON h.id = hre.horse_id
      JOIN transaction_categories tc ON tc.id = hre.category_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY hre.transaction_date DESC, hre.id DESC
    `;

    const result = await this.pool.query(query, params);
    return result.rows.map((row: any) => ({
      id: String(row.id),
      date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
      horseId: String(row.horseId),
      horseName: row.horseName,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categoryType: row.categoryType,
      categoryGroup: row.categoryGroup,
      amount: parseFloat(row.amount),
      notes: row.notes || '',
    }));
  }

  async addTransactions(
    items: AddTransactionItem[],
    userId: number
  ): Promise<HorseRevenueExpenseItem[]> {
    if (!items.length) return [];

    const inserted: HorseRevenueExpenseItem[] = [];
    const client = await this.pool.connect();

    try {
      for (const item of items) {
        const catResult = await client.query(
          'SELECT name, type, group_name FROM transaction_categories WHERE id = $1',
          [item.categoryId]
        );
        if (catResult.rows.length === 0) {
          throw new Error(`Invalid category_id: ${item.categoryId}`);
        }
        const cat = catResult.rows[0];

        const horseResult = await client.query(
          'SELECT name FROM horses WHERE id = $1',
          [item.horseId]
        );
        if (horseResult.rows.length === 0) {
          throw new Error(`Invalid horse_id: ${item.horseId}`);
        }
        const horseName = horseResult.rows[0].name;

        const insertResult = await client.query(
          `INSERT INTO horse_revenue_expense (horse_id, category_id, transaction_date, amount, notes, created_by)
           VALUES ($1, $2, $3::date, $4, $5, $6)
           RETURNING id, transaction_date, horse_id, category_id, amount, notes`,
          [item.horseId, item.categoryId, item.date, item.amount, item.notes ?? '', userId]
        );
        const row = insertResult.rows[0];
        inserted.push({
          id: String(row.id),
          date: row.transaction_date instanceof Date
            ? row.transaction_date.toISOString().slice(0, 10)
            : String(row.transaction_date).slice(0, 10),
          horseId: String(row.horse_id),
          horseName,
          categoryId: row.category_id,
          categoryName: cat.name,
          categoryType: cat.type,
          categoryGroup: cat.group_name,
          amount: parseFloat(row.amount),
          notes: row.notes || '',
        });
      }
      return inserted;
    } finally {
      client.release();
    }
  }
}
