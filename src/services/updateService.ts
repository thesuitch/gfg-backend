import { Pool } from 'pg';
import { StableUpdate, CreateUpdateInput, UpdateFilters } from '../types/update';
import { sendEmail } from '../utils/email';
import { logger } from '../utils/logger';

function mapRow(row: Record<string, unknown>): StableUpdate {
  return {
    id: row.id as number,
    title: row.title as string,
    description: row.description as string,
    type: row.type as 'news' | 'activity',
    horseId: row.horseId != null ? Number(row.horseId) : null,
    horseName: (row.horseName as string) ?? null,
    isGeneral: Boolean(row.isGeneral),
    createdAt: String(row.createdAt),
  };
}

const SELECT_BASE = `
  SELECT su.id, su.title, su.description, su.type,
         su.horse_id as "horseId", h.name as "horseName",
         su.is_general as "isGeneral", su.created_at as "createdAt"
  FROM stable_updates su
  LEFT JOIN horses h ON h.id = su.horse_id
`;

export class UpdateService {
  constructor(private pool: Pool) {}

  async getMemberHorseIds(memberId: number): Promise<number[]> {
    const result = await this.pool.query(
      `SELECT horse_id FROM horse_ownership WHERE member_id = $1 AND is_active = true`,
      [memberId]
    );
    return result.rows.map((r: { horse_id: number }) => r.horse_id);
  }

  async getUpdates(filters: UpdateFilters = {}): Promise<StableUpdate[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.month != null && filters.year != null) {
      conditions.push(`EXTRACT(MONTH FROM su.created_at) = $${idx++}`);
      params.push(filters.month);
      conditions.push(`EXTRACT(YEAR FROM su.created_at) = $${idx++}`);
      params.push(filters.year);
    } else if (filters.year != null) {
      conditions.push(`EXTRACT(YEAR FROM su.created_at) = $${idx++}`);
      params.push(filters.year);
    }

    if (filters.horseId != null) {
      conditions.push(`su.horse_id = $${idx++}`);
      params.push(filters.horseId);
    }

    if (filters.memberHorseIds && filters.memberHorseIds.length > 0) {
      conditions.push(`(su.is_general = true OR su.horse_id = ANY($${idx++}))`);
      params.push(filters.memberHorseIds);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `${SELECT_BASE} ${where} ORDER BY su.created_at DESC`,
      params
    );
    return result.rows.map(mapRow);
  }

  async createUpdate(input: CreateUpdateInput, createdBy: number): Promise<StableUpdate> {
    const result = await this.pool.query(
      `INSERT INTO stable_updates (title, description, type, horse_id, is_general, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.title,
        input.description,
        input.type,
        input.isGeneral ? null : input.horseId ?? null,
        input.isGeneral,
        createdBy,
      ]
    );
    const id = result.rows[0].id as number;
    const updates = await this.getUpdates({});
    const created = updates.find((u) => u.id === id);
    if (!created) throw new Error('Failed to load created update');
    return created;
  }

  async deleteUpdate(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM stable_updates WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async emailUpdate(
    updateId: number,
    audience: 'all' | 'horse_owners'
  ): Promise<{ sent: number; recipients: string[] }> {
    const updateResult = await this.pool.query(
      `${SELECT_BASE} WHERE su.id = $1`,
      [updateId]
    );
    if (updateResult.rows.length === 0) {
      throw new Error('Update not found');
    }
    const update = mapRow(updateResult.rows[0]);

    let emails: string[] = [];

    if (audience === 'all') {
      const members = await this.pool.query(
        `SELECT DISTINCT email FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE r.name = 'member' AND u.is_active = true AND u.email IS NOT NULL`
      );
      emails = members.rows.map((r: { email: string }) => r.email).filter(Boolean);
    } else {
      if (!update.horseId) {
        throw new Error('This update is not tagged to a horse');
      }
      const owners = await this.pool.query(
        `SELECT DISTINCT u.email FROM users u
         JOIN horse_ownership ho ON ho.member_id = u.id
         WHERE ho.horse_id = $1 AND ho.is_active = true AND u.email IS NOT NULL`,
        [update.horseId]
      );
      emails = owners.rows.map((r: { email: string }) => r.email).filter(Boolean);
    }

    if (emails.length === 0) {
      return { sent: 0, recipients: [] };
    }

    const horseLine = update.horseName ? `<p><strong>Horse:</strong> ${update.horseName}</p>` : '';
    const html = `
      <h2>${update.title}</h2>
      <p>${update.description.replace(/\n/g, '<br>')}</p>
      ${horseLine}
      <p style="color:#666;font-size:12px;">Go For Glory Stable — Update notification</p>
    `;

    await sendEmail({
      to: emails,
      subject: `[GFG Stable] ${update.title}`,
      text: `${update.title}\n\n${update.description}`,
      html,
    });

    logger.info(`Update ${updateId} emailed to ${emails.length} recipient(s)`);
    return { sent: emails.length, recipients: emails };
  }
}
