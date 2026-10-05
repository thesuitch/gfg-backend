export interface OwnershipEvent {
  date: string;
  horseId: number;
  memberId: number;
  deltaPercent: number;
}

export interface HorseRnELine {
  id: number;
  horseId: number;
  horseName: string;
  date: string;
  categoryName: string;
  categoryType: 'revenue' | 'expense' | 'adjustment';
  amount: number;
  notes?: string;
}

export interface ActivityLine {
  memberId: number;
  horseId: number | null;
  horseName: string | null;
  date: string;
  activityType: string;
  amount: number;
  fee: number | null;
  percentage: number | null;
  notes: string | null;
}

export interface StatementTransaction {
  id: string;
  date: string;
  horseId: string;
  horseName: string;
  type: 'revenue' | 'expense' | 'adjustment';
  category: string;
  amount: number;
  description: string;
  affectsBalance: boolean;
}

export interface MemberStatementDraft {
  memberId: number;
  memberName: string;
  month: string;
  year: number;
  totalExpenses: number;
  totalRevenue: number;
  netAmount: number;
  isPaid: boolean;
  dueDate: string;
  generatedDate: string;
  transactions: StatementTransaction[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ACTIVITY_LABELS: Record<string, string> = {
  direct_purchase: 'Direct purchase',
  direct_sale: 'Direct sale',
  marketplace_purchase: 'Marketplace purchase',
  marketplace_sale: 'Marketplace sale',
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  adjustment: 'Adjustment',
  prior_balance: 'Prior balance',
  online_service_fee: 'Online service fee',
  marketplace_processing_fee: 'GFG Marketplace 5% Processing Fee',
};

const BALANCE_ACTIVITY_TYPES = new Set([
  'deposit',
  'withdrawal',
  'adjustment',
  'prior_balance',
  'online_service_fee',
  'marketplace_processing_fee',
]);

const INFORMATIONAL_ACTIVITY_TYPES = new Set([
  'direct_purchase',
  'direct_sale',
  'marketplace_purchase',
  'marketplace_sale',
]);

export function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { start, end };
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function formatInvoiceNumber(year: number, month: number, seq: number): string {
  return `GFG-${year}-${String(month).padStart(2, '0')}-${String(seq).padStart(5, '0')}`;
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] || String(month);
}

export function ownershipAsOf(
  events: OwnershipEvent[],
  horseId: number,
  asOfDate: string
): Map<number, number> {
  const owned = new Map<number, number>();
  const relevant = events
    .filter((e) => e.horseId === horseId && e.date <= asOfDate)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));

  for (const event of relevant) {
    const next = (owned.get(event.memberId) || 0) + event.deltaPercent;
    if (Math.abs(next) < 0.0001) owned.delete(event.memberId);
    else owned.set(event.memberId, next);
  }
  return owned;
}

export function membersWhoOwnedHorseInPeriod(
  events: OwnershipEvent[],
  horseId: number,
  start: string,
  end: string
): Set<number> {
  const owners = new Set<number>();
  const snapshot = ownershipAsOf(events, horseId, addDays(start, -1));
  for (const [memberId, pct] of snapshot) {
    if (pct > 0) owners.add(memberId);
  }

  const during = events
    .filter((e) => e.horseId === horseId && e.date >= start && e.date <= end)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));

  const running = new Map(snapshot);
  for (const event of during) {
    const next = (running.get(event.memberId) || 0) + event.deltaPercent;
    if (Math.abs(next) < 0.0001) running.delete(event.memberId);
    else running.set(event.memberId, next);
    for (const [memberId, pct] of running) {
      if (pct > 0) owners.add(memberId);
    }
  }
  return owners;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function allocateByOwnership(
  amount: number,
  ownership: Map<number, number>
): { memberId: number; percent: number; amount: number }[] {
  const owners = [...ownership.entries()]
    .filter(([, pct]) => pct > 0)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  if (owners.length === 0 || amount === 0) return [];

  const amountCents = Math.round(amount * 100);
  // Remainder from unowned % stays with GFG — do not renormalize to 100%.
  const raw = owners.map(([memberId, percent]) => {
    const shareCents = Math.trunc((amountCents * percent) / 100);
    return { memberId, percent, cents: shareCents };
  });

  return raw
    .filter((row) => row.cents !== 0)
    .map((row) => ({
      memberId: row.memberId,
      percent: row.percent,
      amount: row.cents / 100,
    }));
}

function activityTypeToLineType(activityType: string, amount: number): StatementTransaction['type'] {
  if (activityType === 'marketplace_processing_fee' || activityType === 'online_service_fee' || activityType === 'withdrawal') {
    return 'expense';
  }
  if (activityType === 'deposit') return 'revenue';
  if (INFORMATIONAL_ACTIVITY_TYPES.has(activityType)) return 'adjustment';
  return amount >= 0 ? 'revenue' : 'expense';
}

export function buildStatementsForPeriod(input: {
  year: number;
  month: number;
  generatedDate: string;
  members: { id: number; name: string }[];
  horses: { id: number; name: string }[];
  ownershipEvents: OwnershipEvent[];
  rneLines: HorseRnELine[];
  activities: ActivityLine[];
}): MemberStatementDraft[] {
  const { start, end } = monthBounds(input.year, input.month);
  const dueDate = addDays(input.generatedDate, 7);
  const periodName = monthName(input.month);

  const linesByMember = new Map<number, StatementTransaction[]>();
  const ensure = (memberId: number) => {
    if (!linesByMember.has(memberId)) linesByMember.set(memberId, []);
    return linesByMember.get(memberId)!;
  };

  for (const rne of input.rneLines) {
    if (rne.date < start || rne.date > end) continue;
    const ownership = ownershipAsOf(input.ownershipEvents, rne.horseId, rne.date);
    const parts = allocateByOwnership(rne.amount, ownership);
    for (const part of parts) {
      const signed = part.amount;
      const displayAmount = rne.categoryType === 'expense' ? Math.abs(signed) : signed;
      const type: StatementTransaction['type'] =
        rne.categoryType === 'adjustment'
          ? 'adjustment'
          : rne.categoryType;
      ensure(part.memberId).push({
        id: `rne-${rne.id}-${part.memberId}`,
        date: rne.date,
        horseId: String(rne.horseId),
        horseName: rne.horseName,
        type,
        category: rne.categoryName,
        amount: displayAmount,
        description: rne.notes
          ? `${rne.categoryName} (${part.percent}%)${rne.notes ? ` — ${rne.notes}` : ''}`
          : `${rne.categoryName} (${part.percent}%)`,
        affectsBalance: true,
      });
    }
  }

  for (const horse of input.horses) {
    const owners = membersWhoOwnedHorseInPeriod(input.ownershipEvents, horse.id, start, end);
    for (const memberId of owners) {
      const existing = ensure(memberId);
      const hasHorseLine = existing.some((t) => t.horseId === String(horse.id) && t.affectsBalance);
      if (!hasHorseLine) {
        existing.push({
          id: `placeholder-${horse.id}-${memberId}`,
          date: end,
          horseId: String(horse.id),
          horseName: horse.name,
          type: 'adjustment',
          category: 'activity',
          amount: 0,
          description: 'No activity this period',
          affectsBalance: false,
        });
      }
    }
  }

  for (const activity of input.activities) {
    if (activity.date < start || activity.date > end) continue;
    const horseName = activity.horseName || 'General';
    const horseId = activity.horseId != null ? String(activity.horseId) : '';
    const pct = activity.percentage != null ? ` ${activity.percentage}%` : '';
    const label = ACTIVITY_LABELS[activity.activityType] || activity.activityType;

    if (INFORMATIONAL_ACTIVITY_TYPES.has(activity.activityType)) {
      ensure(activity.memberId).push({
        id: `act-${activity.activityType}-${activity.memberId}-${activity.date}-${horseId}`,
        date: activity.date,
        horseId,
        horseName,
        type: 'adjustment',
        category: activity.activityType,
        amount: Math.abs(activity.amount),
        description: `${label}${pct}`.trim(),
        affectsBalance: false,
      });

      if (
        activity.activityType === 'marketplace_sale' &&
        activity.fee != null &&
        activity.fee > 0
      ) {
        ensure(activity.memberId).push({
          id: `fee-${activity.memberId}-${activity.date}-${horseId}`,
          date: activity.date,
          horseId,
          horseName,
          type: 'expense',
          category: 'marketplace_processing_fee',
          amount: roundCents(activity.fee),
          description: 'GFG Marketplace 5% Processing Fee',
          affectsBalance: true,
        });
      }
      continue;
    }

    if (BALANCE_ACTIVITY_TYPES.has(activity.activityType)) {
      const type = activityTypeToLineType(activity.activityType, activity.amount);
      const displayAmount =
        type === 'expense' ? Math.abs(activity.amount) : activity.amount;
      ensure(activity.memberId).push({
        id: `act-${activity.activityType}-${activity.memberId}-${activity.date}-${horseId || 'g'}`,
        date: activity.date,
        horseId,
        horseName,
        type,
        category: activity.activityType,
        amount: displayAmount,
        description: activity.notes || label,
        affectsBalance: true,
      });
    }
  }

  const memberIds = new Set<number>([
    ...input.members.map((m) => m.id),
    ...linesByMember.keys(),
  ]);

  const drafts: MemberStatementDraft[] = [];
  for (const member of input.members) {
    if (!memberIds.has(member.id)) continue;
    const transactions = (linesByMember.get(member.id) || []).sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.horseName.localeCompare(b.horseName);
    });
    if (transactions.length === 0) continue;

    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const tx of transactions) {
      if (!tx.affectsBalance) continue;
      if (tx.type === 'revenue' || (tx.type === 'adjustment' && tx.amount > 0)) {
        totalRevenue = roundCents(totalRevenue + tx.amount);
      } else if (tx.type === 'expense' || (tx.type === 'adjustment' && tx.amount < 0)) {
        totalExpenses = roundCents(totalExpenses + Math.abs(tx.amount));
      }
    }
    const netAmount = roundCents(totalRevenue - totalExpenses);
    drafts.push({
      memberId: member.id,
      memberName: member.name,
      month: periodName,
      year: input.year,
      totalExpenses,
      totalRevenue,
      netAmount,
      isPaid: netAmount >= 0,
      dueDate,
      generatedDate: input.generatedDate,
      transactions,
    });
  }

  return drafts;
}
