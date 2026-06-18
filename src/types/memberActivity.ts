export type MemberActivityType =
  | 'direct_purchase'
  | 'direct_sale'
  | 'marketplace_purchase'
  | 'marketplace_sale'
  | 'deposit'
  | 'withdrawal'
  | 'adjustment'
  | 'prior_balance'
  | 'online_service_fee'
  | 'marketplace_processing_fee';

export type MemberActivitySource = 'manual' | 'purchase_api' | 'marketplace';

export interface MemberActivity {
  id: number;
  memberId: number;
  memberName: string;
  activityType: MemberActivityType;
  horseId: number | null;
  horseName: string | null;
  activityDate: string;
  percentage: number | null;
  amount: number;
  fee: number | null;
  notes: string | null;
  source: MemberActivitySource;
  createdAt: string;
}

export interface CreateMemberActivityInput {
  memberId: number;
  activityType: MemberActivityType;
  horseId?: number | null;
  activityDate: string;
  percentage?: number | null;
  amount: number;
  fee?: number | null;
  notes?: string | null;
  source?: MemberActivitySource;
}

export interface MemberActivityFilters {
  memberId?: number;
  horseId?: number;
  activityType?: MemberActivityType;
  dateFrom?: string;
  dateTo?: string;
}
