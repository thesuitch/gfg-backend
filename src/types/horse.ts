export interface Horse {
  id: number;
  name: string;
  sire: string;
  dam: string;
  sex: 'colt' | 'filly' | 'gelding' | 'mare' | 'stallion';
  age: number;
  ageCategory: '1YO' | '2YO' | '3YO' | '4YO' | '5YO' | '6YO' | '7YO' | '8YO+';
  gait: 'trotter' | 'pacer';
  status: 'new' | 'old';
  horseType: 'standardbred' | 'thoroughbred' | 'quarter_horse' | 'arabian' | 'other';
  jurisdiction: string[];
  trainer?: string;
  stableLocation?: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue?: number;
  pricePerPercent: number;
  initialShares: number;
  currentShares: number;
  sharesRemaining: number;
  wins: number;
  places: number;
  shows: number;
  races: number;
  earnings: number;
  imageUrl?: string;
  description?: string;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface HorseOwnership {
  id: number;
  horseId: number;
  memberId: number;
  percentage: number;
  purchaseDate: string;
  purchasePrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HorseTransaction {
  id: number;
  horseId: number;
  memberId: number;
  transactionType: 'purchase' | 'sale' | 'transfer';
  percentage: number;
  pricePerPercent: number;
  totalAmount: number;
  transactionDate: string;
  notes?: string;
  createdBy: number;
  createdAt: string;
}

export interface HorsePerformanceUpdate {
  id: number;
  horseId: number;
  wins: number;
  places: number;
  shows: number;
  races: number;
  earnings: number;
  updateDate: string;
  notes?: string;
  updatedBy: number;
  createdAt: string;
}

export interface HorseFinancialUpdate {
  id: number;
  horseId: number;
  currentValue?: number;
  pricePerPercent?: number;
  sharesRemaining?: number;
  updateDate: string;
  notes?: string;
  updatedBy: number;
  createdAt: string;
}

export interface CreateHorseRequest {
  name: string;
  sire: string;
  dam: string;
  sex: 'colt' | 'filly' | 'gelding' | 'mare' | 'stallion';
  age: number;
  ageCategory: '1YO' | '2YO' | '3YO' | '4YO' | '5YO' | '6YO' | '7YO' | '8YO+';
  gait: 'trotter' | 'pacer';
  status: 'new' | 'old';
  horseType: 'standardbred' | 'thoroughbred' | 'quarter_horse' | 'arabian' | 'other';
  jurisdiction: string[];
  trainer?: string;
  stableLocation?: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue?: number;
  pricePerPercent: number;
  initialShares?: number;
  currentShares?: number;
  wins?: number;
  places?: number;
  shows?: number;
  races?: number;
  earnings?: number;
  imageUrl?: string;
  description?: string;
}

export interface UpdateHorseRequest {
  name?: string;
  sire?: string;
  dam?: string;
  sex?: 'colt' | 'filly' | 'gelding' | 'mare' | 'stallion';
  age?: number;
  ageCategory?: '1YO' | '2YO' | '3YO' | '4YO' | '5YO' | '6YO' | '7YO' | '8YO+';
  gait?: 'trotter' | 'pacer';
  status?: 'new' | 'old';
  horseType?: 'standardbred' | 'thoroughbred' | 'quarter_horse' | 'arabian' | 'other';
  jurisdiction?: string[];
  trainer?: string;
  stableLocation?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  pricePerPercent?: number;
  initialShares?: number;
  currentShares?: number;
  wins?: number;
  places?: number;
  shows?: number;
  races?: number;
  earnings?: number;
  imageUrl?: string;
  description?: string;
}

export interface HorseFilters {
  search?: string;
  status?: string;
  age?: string;
  gait?: string;
  jurisdiction?: string;
  sex?: string;
  sire?: string;
  trainer?: string;
  horseType?: string;
  priceRange?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface HorseStatistics {
  totalHorses: number;
  activeHorses: number;
  retiredHorses: number;
  soldHorses: number;
  totalValue: number;
  averageValue: number;
  totalEarnings: number;
  averageEarnings: number;
}

export interface PurchaseSharesRequest {
  memberId: number;
  percentage: number;
}

export interface UpdatePerformanceRequest {
  wins?: number;
  places?: number;
  shows?: number;
  races?: number;
  earnings?: number;
  updateDate?: string;
  notes?: string;
}

export interface UpdateFinancialsRequest {
  currentValue?: number;
  pricePerPercent?: number;
  sharesRemaining?: number;
  updateDate?: string;
  notes?: string;
}
