// Signage: whether category amounts are positive, negative, or both
export type CategorySignage = 'positive' | 'negative' | 'both';

// Transaction category (Horse Revenue & Expense)
export interface TransactionCategory {
  id: string;
  name: string;
  type: 'revenue' | 'expense' | 'adjustment';
  group: string;
  allowsNegative?: boolean;
  description?: string | null;
  isCore?: boolean;
  signage?: CategorySignage;
}

export interface CreateCategoryInput {
  id: string;
  name: string;
  type: 'revenue' | 'expense' | 'adjustment';
  description?: string;
  allowsNegative?: boolean;
  signage?: CategorySignage;
}

export interface UpdateCategoryInput {
  name?: string;
  type?: 'revenue' | 'expense' | 'adjustment';
  description?: string;
  allowsNegative?: boolean;
  signage?: CategorySignage;
}

// Horse revenue/expense line item - matches frontend HorseRevenueExpenseItem shape
export interface HorseRevenueExpenseItem {
  id: string;
  date: string;
  horseId: string;
  horseName: string;
  categoryId: string;
  categoryName: string;
  categoryType: 'revenue' | 'expense' | 'adjustment';
  categoryGroup: string;
  amount: number;
  notes: string;
}

export interface TransactionFilters {
  horseId?: number;
  categoryId?: string;
  type?: 'revenue' | 'expense' | 'adjustment';
  dateFrom?: string;
  dateTo?: string;
}

export interface AddTransactionItem {
  horseId: number;
  categoryId: string;
  date: string;
  amount: number;
  notes?: string;
}
