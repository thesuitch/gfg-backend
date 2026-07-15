import { Pool, PoolClient } from 'pg';
import {
  MemberActivity,
  CreateMemberActivityInput,
  MemberActivityFilters,
  MemberActivityType,
} from '../types/memberActivity';
import { logger } from '../utils/logger';

/** pg DATE values arrive as Date at UTC midnight; never String(date).slice(0, 10). */
function formatPgDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value ?? '');
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return match ? match[1] : s.slice(0, 10);
}

function mapRow(row: Record<string, unknown>): MemberActivity {
  return {
    id: row.id as number,
    memberId: row.memberId as number,
    memberName: row.memberName as string,
    activityType: row.activityType as MemberActivityType,
    horseId: row.horseId != null ? Number(row.horseId) : null,
    horseName: (row.horseName as string) ?? null,
    activityDate: formatPgDate(row.activityDate),
    percentage: row.percentage != null ? Number(row.percentage) : null,
    amount: Number(row.amount),
    fee: row.fee != null ? Number(row.fee) : null,
    notes: (row.notes as string) ?? null,
    source: row.source as MemberActivity['source'],
    createdAt: String(row.createdAt),
  };
}

const SELECT_BASE = `
  SELECT ma.id,
         ma.member_id as "memberId",
         CONCAT(u.first_name, ' ', u.last_name) as "memberName",
         ma.activity_type as "activityType",
         ma.horse_id as "horseId",
         h.name as "horseName",
         ma.activity_date as "activityDate",
         ma.percentage,
         ma.amount,
         ma.fee,
         ma.notes,
         ma.source,
         ma.created_at as "createdAt"
  FROM member_activities ma
  JOIN users u ON u.id = ma.member_id
  LEFT JOIN horses h ON h.id = ma.horse_id
`;

export class MemberActivityService {
  constructor(private pool: Pool) {}

  async getActivities(filters: MemberActivityFilters = {}): Promise<MemberActivity[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.memberId != null) {
      conditions.push(`ma.member_id = $${idx++}`);
      params.push(filters.memberId);
    }
    if (filters.horseId != null) {
      conditions.push(`ma.horse_id = $${idx++}`);
      params.push(filters.horseId);
    }
    if (filters.activityType) {
      conditions.push(`ma.activity_type = $${idx++}`);
      params.push(filters.activityType);
    }
    if (filters.dateFrom) {
      conditions.push(`ma.activity_date >= $${idx++}`);
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push(`ma.activity_date <= $${idx++}`);
      params.push(filters.dateTo);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `${SELECT_BASE} ${where} ORDER BY ma.activity_date DESC, ma.id DESC`,
      params
    );
    return result.rows.map(mapRow);
  }

  async createActivity(
    input: CreateMemberActivityInput,
    createdBy: number,
    client?: PoolClient
  ): Promise<MemberActivity> {
    const db = client ?? this.pool;
    const result = await db.query(
      `INSERT INTO member_activities (
        member_id, activity_type, horse_id, activity_date, percentage, amount, fee, notes, source, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        input.memberId,
        input.activityType,
        input.horseId ?? null,
        input.activityDate.slice(0, 10),
        input.percentage ?? null,
        input.amount,
        input.fee ?? null,
        input.notes ?? null,
        input.source ?? 'manual',
        createdBy,
      ]
    );
    const id = result.rows[0].id as number;
    const items = await this.getActivities({});
    const created = items.find((a) => a.id === id);
    if (!created) throw new Error('Failed to load created activity');
    return created;
  }

  /** Auto-log when shares are purchased directly from GFG. */
  async createFromDirectPurchase(
    client: PoolClient,
    params: {
      memberId: number;
      horseId: number;
      percentage: number;
      totalAmount: number;
      createdBy: number;
    }
  ): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await client.query(
      `INSERT INTO member_activities (
        member_id, activity_type, horse_id, activity_date, percentage, amount, notes, source, created_by
      ) VALUES ($1, 'direct_purchase', $2, $3, $4, $5, $6, 'purchase_api', $7)`,
      [
        params.memberId,
        params.horseId,
        today,
        params.percentage,
        -Math.abs(params.totalAmount),
        `Auto-logged: Direct purchase of ${params.percentage}% from GFG`,
        params.createdBy,
      ]
    );
  }

  /** Auto-log marketplace purchase/sale (called when marketplace transfer completes). */
  async createFromMarketplace(
    client: PoolClient,
    params: {
      buyerId: number;
      sellerId: number;
      horseId: number;
      percentage: number;
      amount: number;
      createdBy: number;
    }
  ): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const commission = Math.abs(params.amount) * 0.05;
    await client.query(
      `INSERT INTO member_activities (
        member_id, activity_type, horse_id, activity_date, percentage, amount, fee, notes, source, created_by
      ) VALUES ($1, 'marketplace_purchase', $2, $3, $4, $5, $6, $7, 'marketplace', $8)`,
      [
        params.buyerId,
        params.horseId,
        today,
        params.percentage,
        -Math.abs(params.amount),
        commission,
        `Auto-logged: Marketplace purchase of ${params.percentage}%`,
        params.createdBy,
      ]
    );
    await client.query(
      `INSERT INTO member_activities (
        member_id, activity_type, horse_id, activity_date, percentage, amount, fee, notes, source, created_by
      ) VALUES ($1, 'marketplace_sale', $2, $3, $4, $5, $6, $7, 'marketplace', $8)`,
      [
        params.sellerId,
        params.horseId,
        today,
        params.percentage,
        Math.abs(params.amount),
        commission,
        `Auto-logged: Marketplace sale of ${params.percentage}%`,
        params.createdBy,
      ]
    );
  }

  async deleteActivity(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM member_activities WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async logMarketplaceTransfer(params: {
    buyerId: number;
    sellerId: number;
    horseId: number;
    percentage: number;
    amount: number;
    createdBy: number;
  }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.createFromMarketplace(client, params);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function ensureMemberActivityTables(pool: Pool): Promise<void> {
  try {
    await pool.query('SELECT 1 FROM member_activities LIMIT 1');
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === '42P01') {
      logger.warn('member_activities table missing — run migration 010');
    } else {
      throw err;
    }
  }
}
