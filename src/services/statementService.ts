import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/email';
import {
  ActivityLine,
  HorseRnELine,
  MemberStatementDraft,
  OwnershipEvent,
  StatementTransaction,
  buildStatementsForPeriod,
  formatInvoiceNumber,
  monthBounds,
  monthName,
} from './statementAllocation';

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

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface StatementSummaryDto {
  id: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  memberEmail?: string;
  month: string;
  year: number;
  periodMonth: number;
  totalExpenses: number;
  totalRevenue: number;
  netAmount: number;
  isPaid: boolean;
  dueDate: string;
  generatedDate: string;
  paidAt?: string | null;
  transactions?: StatementDetailDto['transactions'];
}

export interface StatementDetailDto extends StatementSummaryDto {
  transactions: Array<{
    id: string;
    date: string;
    horseId: string;
    horseName: string;
    type: 'revenue' | 'expense' | 'adjustment';
    category: string;
    amount: number;
    description: string;
  }>;
}

function mapSummary(row: Record<string, unknown>): StatementSummaryDto {
  return {
    id: String(row.id),
    invoiceNumber: String(row.invoice_number),
    memberId: String(row.member_id),
    memberName: String(row.member_name || '').trim() || `Member #${row.member_id}`,
    memberEmail: row.member_email != null ? String(row.member_email) : undefined,
    month: monthName(Number(row.period_month)),
    year: Number(row.period_year),
    periodMonth: Number(row.period_month),
    totalExpenses: parseFloat(String(row.total_expenses)),
    totalRevenue: parseFloat(String(row.total_revenue)),
    netAmount: parseFloat(String(row.net_amount)),
    isPaid: Boolean(row.is_paid),
    dueDate: formatPgDate(row.due_date),
    generatedDate: formatPgDate(row.generated_date),
    paidAt: row.paid_at ? String(row.paid_at) : null,
  };
}

export class StatementService {
  constructor(private pool: Pool) {}

  private async loadOwnershipEvents(): Promise<OwnershipEvent[]> {
    const events: OwnershipEvent[] = [];

    const purchases = await this.pool.query(
      `SELECT horse_id, member_id, percentage, transaction_date, transaction_type
       FROM horse_transactions
       WHERE transaction_type IN ('purchase', 'sale')
       ORDER BY transaction_date ASC, id ASC`
    );
    for (const row of purchases.rows) {
      const delta = parseFloat(String(row.percentage));
      events.push({
        date: formatPgDate(row.transaction_date),
        horseId: Number(row.horse_id),
        memberId: Number(row.member_id),
        deltaPercent: row.transaction_type === 'sale' ? -delta : delta,
      });
    }

    const transfers = await this.pool.query(
      `SELECT horse_id, buyer_id, seller_id, percentage,
              COALESCE(transfer_date, confirmed_at, created_at) AS event_date
       FROM marketplace_transfers
       WHERE status = 'completed'
       ORDER BY COALESCE(transfer_date, confirmed_at, created_at) ASC, id ASC`
    );
    for (const row of transfers.rows) {
      const pct = parseFloat(String(row.percentage));
      const date = formatPgDate(row.event_date);
      events.push({
        date,
        horseId: Number(row.horse_id),
        memberId: Number(row.buyer_id),
        deltaPercent: pct,
      });
      events.push({
        date,
        horseId: Number(row.horse_id),
        memberId: Number(row.seller_id),
        deltaPercent: -pct,
      });
    }

    const seeded = await this.pool.query(
      `SELECT ho.horse_id, ho.member_id, ho.percentage, ho.purchase_date
       FROM horse_ownership ho
       WHERE NOT EXISTS (
         SELECT 1 FROM horse_transactions ht
         WHERE ht.horse_id = ho.horse_id
           AND ht.member_id = ho.member_id
           AND ht.transaction_type = 'purchase'
       )
       AND NOT EXISTS (
         SELECT 1 FROM marketplace_transfers mt
         WHERE mt.horse_id = ho.horse_id
           AND mt.buyer_id = ho.member_id
           AND mt.status = 'completed'
       )`
    );
    for (const row of seeded.rows) {
      events.push({
        date: formatPgDate(row.purchase_date),
        horseId: Number(row.horse_id),
        memberId: Number(row.member_id),
        deltaPercent: parseFloat(String(row.percentage)),
      });
    }

    return events;
  }

  async generatePeriod(
    year: number,
    month: number,
    generatedBy: number
  ): Promise<{ created: number; updated: number; skippedPaid: number }> {
    if (month < 1 || month > 12) {
      throw Object.assign(new Error('Month must be 1-12'), { code: 'INVALID_PERIOD' });
    }

    const membersResult = await this.pool.query(
      `SELECT u.id, TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'member' AND u.is_active = true
       ORDER BY u.id`
    );
    const horsesResult = await this.pool.query(`SELECT id, name FROM horses ORDER BY name`);
    const { start, end } = monthBounds(year, month);

    const rneResult = await this.pool.query(
      `SELECT hre.id, hre.horse_id, h.name AS horse_name, hre.transaction_date,
              tc.name AS category_name, tc.type AS category_type, hre.amount, hre.notes
       FROM horse_revenue_expense hre
       JOIN horses h ON h.id = hre.horse_id
       JOIN transaction_categories tc ON tc.id = hre.category_id
       WHERE hre.transaction_date BETWEEN $1 AND $2
       ORDER BY hre.transaction_date ASC, hre.id ASC`,
      [start, end]
    );
    const rneLines: HorseRnELine[] = rneResult.rows.map((row) => ({
      id: Number(row.id),
      horseId: Number(row.horse_id),
      horseName: String(row.horse_name),
      date: formatPgDate(row.transaction_date),
      categoryName: String(row.category_name),
      categoryType: row.category_type,
      amount: parseFloat(String(row.amount)),
      notes: row.notes ? String(row.notes) : undefined,
    }));

    const actResult = await this.pool.query(
      `SELECT ma.member_id, ma.horse_id, h.name AS horse_name, ma.activity_date,
              ma.activity_type, ma.amount, ma.fee, ma.percentage, ma.notes
       FROM member_activities ma
       LEFT JOIN horses h ON h.id = ma.horse_id
       WHERE ma.activity_date BETWEEN $1 AND $2
       ORDER BY ma.activity_date ASC, ma.id ASC`,
      [start, end]
    );
    const activities: ActivityLine[] = actResult.rows.map((row) => ({
      memberId: Number(row.member_id),
      horseId: row.horse_id != null ? Number(row.horse_id) : null,
      horseName: row.horse_name != null ? String(row.horse_name) : null,
      date: formatPgDate(row.activity_date),
      activityType: String(row.activity_type),
      amount: parseFloat(String(row.amount)),
      fee: row.fee != null ? parseFloat(String(row.fee)) : null,
      percentage: row.percentage != null ? parseFloat(String(row.percentage)) : null,
      notes: row.notes != null ? String(row.notes) : null,
    }));

    const drafts = buildStatementsForPeriod({
      year,
      month,
      generatedDate: todayUtc(),
      members: membersResult.rows.map((r) => ({ id: Number(r.id), name: String(r.name).trim() || `Member #${r.id}` })),
      horses: horsesResult.rows.map((r) => ({ id: Number(r.id), name: String(r.name) })),
      ownershipEvents: await this.loadOwnershipEvents(),
      rneLines,
      activities,
    });

    let created = 0;
    let updated = 0;
    let skippedPaid = 0;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const draft of drafts) {
        const existing = await client.query(
          `SELECT id, is_paid FROM member_statements
           WHERE member_id = $1 AND period_year = $2 AND period_month = $3`,
          [draft.memberId, year, month]
        );
        if (existing.rows[0]?.is_paid) {
          skippedPaid += 1;
          continue;
        }

        const invoiceNumber = formatInvoiceNumber(year, month, draft.memberId);
        let statementId: number;
        if (existing.rows[0]) {
          statementId = Number(existing.rows[0].id);
          await client.query(
            `UPDATE member_statements
             SET invoice_number = $2,
                 generated_date = $3,
                 due_date = $4,
                 total_expenses = $5,
                 total_revenue = $6,
                 net_amount = $7,
                 is_paid = $8,
                 paid_at = CASE WHEN $8 THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE NULL END,
                 generated_by = $9,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [
              statementId,
              invoiceNumber,
              draft.generatedDate,
              draft.dueDate,
              draft.totalExpenses,
              draft.totalRevenue,
              draft.netAmount,
              draft.isPaid,
              generatedBy,
            ]
          );
          await client.query(`DELETE FROM member_statement_lines WHERE statement_id = $1`, [statementId]);
          updated += 1;
        } else {
          const inserted = await client.query(
            `INSERT INTO member_statements (
              member_id, period_year, period_month, invoice_number,
              generated_date, due_date, total_expenses, total_revenue, net_amount,
              is_paid, paid_at, generated_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            RETURNING id`,
            [
              draft.memberId,
              year,
              month,
              invoiceNumber,
              draft.generatedDate,
              draft.dueDate,
              draft.totalExpenses,
              draft.totalRevenue,
              draft.netAmount,
              draft.isPaid,
              draft.isPaid ? draft.generatedDate : null,
              generatedBy,
            ]
          );
          statementId = Number(inserted.rows[0].id);
          created += 1;
        }

        for (const tx of draft.transactions) {
          await client.query(
            `INSERT INTO member_statement_lines (
              statement_id, line_date, horse_id, horse_name, description,
              category, line_type, amount, affects_balance
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              statementId,
              tx.date,
              tx.horseId ? Number(tx.horseId) : null,
              tx.horseName || null,
              tx.description,
              tx.category,
              tx.type,
              tx.amount,
              tx.affectsBalance,
            ]
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('generatePeriod failed:', error);
      throw error;
    } finally {
      client.release();
    }

    return { created, updated, skippedPaid };
  }

  async listStatements(filters: {
    memberId?: number;
    year?: number;
    month?: number;
    isPaid?: boolean;
  } = {}): Promise<StatementSummaryDto[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    if (filters.memberId != null) {
      params.push(filters.memberId);
      where.push(`s.member_id = $${params.length}`);
    }
    if (filters.year != null) {
      params.push(filters.year);
      where.push(`s.period_year = $${params.length}`);
    }
    if (filters.month != null) {
      params.push(filters.month);
      where.push(`s.period_month = $${params.length}`);
    }
    if (filters.isPaid != null) {
      params.push(filters.isPaid);
      where.push(`s.is_paid = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT s.*,
              TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS member_name,
              u.email AS member_email
       FROM member_statements s
       JOIN users u ON u.id = s.member_id
       ${whereSql}
       ORDER BY s.period_year DESC, s.period_month DESC, u.last_name ASC, u.first_name ASC`,
      params
    );
    const summaries = result.rows.map(mapSummary);
    if (summaries.length === 0) return summaries;

    const ids = summaries.map((s) => Number(s.id));
    const lines = await this.pool.query(
      `SELECT id, statement_id, line_date, horse_id, horse_name, description, category, line_type, amount
       FROM member_statement_lines
       WHERE statement_id = ANY($1::int[])
       ORDER BY line_date ASC, horse_name ASC NULLS LAST, id ASC`,
      [ids]
    );
    const byStatement = new Map<string, StatementDetailDto['transactions']>();
    for (const row of lines.rows) {
      const key = String(row.statement_id);
      if (!byStatement.has(key)) byStatement.set(key, []);
      byStatement.get(key)!.push({
        id: String(row.id),
        date: formatPgDate(row.line_date),
        horseId: row.horse_id != null ? String(row.horse_id) : '',
        horseName: row.horse_name != null ? String(row.horse_name) : 'General',
        type: row.line_type,
        category: String(row.category),
        amount: parseFloat(String(row.amount)),
        description: String(row.description),
      });
    }
    return summaries.map((s) => ({
      ...s,
      transactions: byStatement.get(s.id) || [],
    }));
  }

  async getStatement(id: number): Promise<StatementDetailDto | null> {
    const result = await this.pool.query(
      `SELECT s.*,
              TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS member_name,
              u.email AS member_email
       FROM member_statements s
       JOIN users u ON u.id = s.member_id
       WHERE s.id = $1`,
      [id]
    );
    if (!result.rows[0]) return null;
    const summary = mapSummary(result.rows[0]);
    const lines = await this.pool.query(
      `SELECT id, line_date, horse_id, horse_name, description, category, line_type, amount, affects_balance
       FROM member_statement_lines
       WHERE statement_id = $1
       ORDER BY line_date ASC, horse_name ASC NULLS LAST, id ASC`,
      [id]
    );
    return {
      ...summary,
      transactions: lines.rows.map((row) => ({
        id: String(row.id),
        date: formatPgDate(row.line_date),
        horseId: row.horse_id != null ? String(row.horse_id) : '',
        horseName: row.horse_name != null ? String(row.horse_name) : 'General',
        type: row.line_type,
        category: String(row.category),
        amount: parseFloat(String(row.amount)),
        description: String(row.description),
      })),
    };
  }

  async markPaid(id: number, actorId: number): Promise<StatementSummaryDto> {
    const result = await this.pool.query(
      `UPDATE member_statements
       SET is_paid = true, paid_at = CURRENT_TIMESTAMP, paid_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [id, actorId]
    );
    if (!result.rows[0]) {
      throw Object.assign(new Error('Statement not found'), { code: 'NOT_FOUND' });
    }
    const detail = await this.getStatement(id);
    if (!detail) throw Object.assign(new Error('Statement not found'), { code: 'NOT_FOUND' });
    return detail;
  }

  renderHtml(detail: StatementDetailDto): string {
    const rows = detail.transactions
      .map((tx) => {
        const sign = tx.type === 'expense' ? '−' : tx.type === 'revenue' ? '+' : '';
        return `<tr>
          <td>${tx.date}</td>
          <td>${escapeHtml(tx.horseName || '')}</td>
          <td>${escapeHtml(tx.description)}</td>
          <td style="text-align:right">${sign}$${Number(tx.amount).toLocaleString()}</td>
        </tr>`;
      })
      .join('');
    const netLabel = detail.netAmount >= 0 ? 'Credit' : 'Due';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${detail.invoiceNumber} — ${detail.month} ${detail.year}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #222; margin: 32px; }
    h1 { color: #2d5016; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px; font-size: 13px; text-align: left; }
    th { background: #f5f5f5; }
    .totals { margin-top: 16px; max-width: 320px; margin-left: auto; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
    .net { font-weight: bold; border-top: 1px solid #222; margin-top: 8px; padding-top: 8px; }
  </style>
</head>
<body>
  <h1>Go For Glory Stable</h1>
  <p>${detail.invoiceNumber}<br/>
  ${escapeHtml(detail.memberName)}<br/>
  ${detail.month} ${detail.year} Statement<br/>
  Generated ${detail.generatedDate} · Due ${detail.dueDate} · ${detail.isPaid ? 'Paid' : 'Unpaid'}</p>
  <table>
    <thead><tr><th>Date</th><th>Horse</th><th>Activity</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Total Revenue</span><span>$${detail.totalRevenue.toLocaleString()}</span></div>
    <div><span>Total Expenses</span><span>$${detail.totalExpenses.toLocaleString()}</span></div>
    <div class="net"><span>Net (${netLabel})</span><span>$${Math.abs(detail.netAmount).toLocaleString()}</span></div>
  </div>
</body>
</html>`;
  }

  async emailStatement(id: number, recipient: 'member' | 'admin'): Promise<void> {
    const detail = await this.getStatement(id);
    if (!detail) throw Object.assign(new Error('Statement not found'), { code: 'NOT_FOUND' });

    const adminEmail = process.env.ADMIN_EMAIL || 'info@goforglorystable.com';
    const to = recipient === 'admin' ? adminEmail : detail.memberEmail;
    if (!to) throw Object.assign(new Error('No email address available'), { code: 'NO_EMAIL' });

    const html = this.renderHtml(detail);
    const netLabel = detail.netAmount >= 0 ? 'credit' : 'amount due';
    await sendEmail({
      to,
      subject: `GFG Statement ${detail.month} ${detail.year} — ${detail.invoiceNumber}`,
      text: `${detail.month} ${detail.year} statement for ${detail.memberName}. Net ${netLabel}: $${Math.abs(detail.netAmount).toLocaleString()}. Due ${detail.dueDate}.`,
      html,
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type { MemberStatementDraft, StatementTransaction };
