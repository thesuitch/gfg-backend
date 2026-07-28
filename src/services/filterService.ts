import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

export type FilterType = 'jurisdiction' | 'sire' | 'trainer' | 'horseType';

export interface FilterOptionRecord {
  id: string;
  value: string;
  label: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface FilterOptionsGrouped {
  jurisdictions: FilterOptionRecord[];
  sires: FilterOptionRecord[];
  trainers: FilterOptionRecord[];
  horseTypes: FilterOptionRecord[];
}

export interface FilterUsageInfo {
  count: number;
  horses: { id: string; name: string }[];
}

const TYPE_TO_RESPONSE_KEY: Record<FilterType, keyof FilterOptionsGrouped> = {
  jurisdiction: 'jurisdictions',
  sire: 'sires',
  trainer: 'trainers',
  horseType: 'horseTypes',
};

const PATH_TO_TYPE: Record<string, FilterType> = {
  jurisdictions: 'jurisdiction',
  sires: 'sire',
  trainers: 'trainer',
  'horse-types': 'horseType',
};

export function filterTypeFromPath(segment: string): FilterType | null {
  return PATH_TO_TYPE[segment] ?? null;
}

function mapRow(row: Record<string, unknown>): FilterOptionRecord {
  return {
    id: String(row.id),
    value: String(row.value),
    label: String(row.label),
    isActive: Boolean(row.is_active),
    order: Number(row.sort_order),
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
    updatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at),
  };
}

export class FilterService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getAllActive(): Promise<FilterOptionsGrouped> {
    const result = await this.pool.query(
      `SELECT id, filter_type, value, label, is_active, sort_order, created_at, updated_at
       FROM filter_options
       WHERE is_active = true
       ORDER BY filter_type, sort_order ASC, label ASC`
    );

    const grouped: FilterOptionsGrouped = {
      jurisdictions: [],
      sires: [],
      trainers: [],
      horseTypes: [],
    };

    for (const row of result.rows) {
      const type = row.filter_type as FilterType;
      const key = TYPE_TO_RESPONSE_KEY[type];
      if (key) grouped[key].push(mapRow(row));
    }

    return grouped;
  }

  async getByType(type: FilterType, activeOnly = true): Promise<FilterOptionRecord[]> {
    const result = await this.pool.query(
      `SELECT id, filter_type, value, label, is_active, sort_order, created_at, updated_at
       FROM filter_options
       WHERE filter_type = $1
         AND ($2::boolean = false OR is_active = true)
       ORDER BY sort_order ASC, label ASC`,
      [type, activeOnly]
    );
    return result.rows.map(mapRow);
  }

  async create(
    type: FilterType,
    data: { value: string; label: string }
  ): Promise<FilterOptionRecord> {
    const value = data.value.trim();
    const label = data.label.trim() || value;

    const dup = await this.pool.query(
      `SELECT id FROM filter_options
       WHERE filter_type = $1 AND LOWER(value) = LOWER($2)`,
      [type, value]
    );
    if (dup.rows.length > 0) {
      const err = new Error('A filter option with this value already exists');
      (err as Error & { code: string }).code = 'DUPLICATE';
      throw err;
    }

    const maxOrder = await this.pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM filter_options WHERE filter_type = $1`,
      [type]
    );
    const nextOrder = Number(maxOrder.rows[0].max_order) + 1;
    const id = `${Date.now()}`;

    const result = await this.pool.query(
      `INSERT INTO filter_options (id, filter_type, value, label, is_active, sort_order)
       VALUES ($1, $2, $3, $4, true, $5)
       RETURNING id, filter_type, value, label, is_active, sort_order, created_at, updated_at`,
      [id, type, value, label, nextOrder]
    );

    return mapRow(result.rows[0]);
  }

  async update(
    type: FilterType,
    id: string,
    data: Partial<{ value: string; label: string; isActive: boolean; order: number }>
  ): Promise<FilterOptionRecord> {
    const existing = await this.pool.query(
      `SELECT id FROM filter_options WHERE filter_type = $1 AND id = $2`,
      [type, id]
    );
    if (existing.rows.length === 0) {
      const err = new Error('Filter option not found');
      (err as Error & { code: string }).code = 'NOT_FOUND';
      throw err;
    }

    if (data.value != null) {
      const dup = await this.pool.query(
        `SELECT id FROM filter_options
         WHERE filter_type = $1 AND LOWER(value) = LOWER($2) AND id <> $3`,
        [type, data.value.trim(), id]
      );
      if (dup.rows.length > 0) {
        const err = new Error('A filter option with this value already exists');
        (err as Error & { code: string }).code = 'DUPLICATE';
        throw err;
      }
    }

    const result = await this.pool.query(
      `UPDATE filter_options SET
         value = COALESCE($3, value),
         label = COALESCE($4, label),
         is_active = COALESCE($5, is_active),
         sort_order = COALESCE($6, sort_order),
         updated_at = CURRENT_TIMESTAMP
       WHERE filter_type = $1 AND id = $2
       RETURNING id, filter_type, value, label, is_active, sort_order, created_at, updated_at`,
      [
        type,
        id,
        data.value != null ? data.value.trim() : null,
        data.label != null ? data.label.trim() : null,
        data.isActive ?? null,
        data.order ?? null,
      ]
    );

    return mapRow(result.rows[0]);
  }

  async getUsage(type: FilterType, id: string): Promise<FilterUsageInfo> {
    let result;
    if (type === 'jurisdiction') {
      result = await this.pool.query(
        `SELECT id, name FROM horses WHERE $1 = ANY(jurisdiction) ORDER BY name`,
        [id]
      );
    } else if (type === 'sire') {
      result = await this.pool.query(
        `SELECT id, name FROM horses WHERE sire = $1 ORDER BY name`,
        [id]
      );
    } else if (type === 'trainer') {
      result = await this.pool.query(
        `SELECT id, name FROM horses WHERE trainer = $1 ORDER BY name`,
        [id]
      );
    } else {
      result = await this.pool.query(
        `SELECT id, name FROM horses WHERE horse_type = $1 ORDER BY name`,
        [id]
      );
    }

    const horses = result.rows.map((r) => ({ id: String(r.id), name: String(r.name) }));
    return { count: horses.length, horses };
  }

  private async reassignOnHorses(
    client: PoolClient,
    type: FilterType,
    fromId: string,
    toId: string
  ): Promise<number> {
    if (type === 'jurisdiction') {
      const result = await client.query(
        `UPDATE horses
         SET jurisdiction = (
               SELECT ARRAY(
                 SELECT DISTINCT CASE WHEN j = $1 THEN $2 ELSE j END
                 FROM unnest(jurisdiction) AS j
               )
             ),
             updated_at = CURRENT_TIMESTAMP
         WHERE $1 = ANY(jurisdiction)`,
        [fromId, toId]
      );
      return result.rowCount ?? 0;
    }

    if (type === 'sire') {
      const result = await client.query(
        `UPDATE horses SET sire = $2, updated_at = CURRENT_TIMESTAMP WHERE sire = $1`,
        [fromId, toId]
      );
      return result.rowCount ?? 0;
    }

    if (type === 'trainer') {
      const result = await client.query(
        `UPDATE horses SET trainer = $2, updated_at = CURRENT_TIMESTAMP WHERE trainer = $1`,
        [fromId, toId]
      );
      return result.rowCount ?? 0;
    }

    const result = await client.query(
      `UPDATE horses SET horse_type = $2, updated_at = CURRENT_TIMESTAMP WHERE horse_type = $1`,
      [fromId, toId]
    );
    return result.rowCount ?? 0;
  }

  async delete(type: FilterType, id: string, reassignToId?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT id FROM filter_options WHERE filter_type = $1 AND id = $2`,
        [type, id]
      );
      if (existing.rows.length === 0) {
        const err = new Error('Filter option not found');
        (err as Error & { code: string }).code = 'NOT_FOUND';
        throw err;
      }

      const usage = await this.getUsage(type, id);
      if (usage.count > 0) {
        if (!reassignToId) {
          const err = new Error(
            `${usage.count} horse(s) use this option. Reassign before deleting.`
          );
          (err as Error & { code: string; usage: FilterUsageInfo }).code = 'IN_USE';
          (err as Error & { usage: FilterUsageInfo }).usage = usage;
          throw err;
        }
        if (reassignToId === id) {
          const err = new Error('Cannot reassign to the same option');
          (err as Error & { code: string }).code = 'INVALID_REASSIGN';
          throw err;
        }
        const target = await client.query(
          `SELECT id FROM filter_options WHERE filter_type = $1 AND id = $2`,
          [type, reassignToId]
        );
        if (target.rows.length === 0) {
          const err = new Error('Replacement filter option not found');
          (err as Error & { code: string }).code = 'INVALID_REASSIGN';
          throw err;
        }
        await this.reassignOnHorses(client, type, id, reassignToId);
      }

      await client.query(
        `DELETE FROM filter_options WHERE filter_type = $1 AND id = $2`,
        [type, id]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting filter option:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
