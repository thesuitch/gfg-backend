import {
  HORSE_AGE_CATEGORIES,
  HORSE_GAITS,
  HORSE_SEXES,
  HORSE_STATUSES,
} from '../constants/horse';

export type HorseStatus = (typeof HORSE_STATUSES)[number];
export type HorseAgeCategory = (typeof HORSE_AGE_CATEGORIES)[number];
export type HorseSex = (typeof HORSE_SEXES)[number];
export type HorseGait = (typeof HORSE_GAITS)[number];

export interface Horse {
  id: number;
  name: string;
  sireId: string;
  dam: string;
  sex: HorseSex;
  age: number;
  ageCategory: HorseAgeCategory;
  gait: HorseGait;
  status: HorseStatus;
  horseTypeId: string;
  jurisdictionIds: string[];
  trainerId?: string;
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
  archived: boolean;
  isNew: boolean;
  salePrice?: number;
  lifetimePastPerformanceUrl?: string;
  pedigreeUrl?: string;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
  /** @deprecated Legacy — same value as sireId when stored as filter ID */
  sire?: string;
  trainer?: string;
  jurisdiction?: string[];
  /** @deprecated Legacy — filter option ID stored as horse_type */
  horseType?: string;
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
  sireId: string;
  dam: string;
  sex: HorseSex;
  age: number;
  ageCategory: HorseAgeCategory;
  gait: HorseGait;
  status?: HorseStatus;
  isNew?: boolean;
  horseTypeId: string;
  jurisdictionIds: string[];
  trainerId?: string;
  stableLocation?: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue?: number;
  pricePerPercent: number;
  initialShares?: number;
  currentShares?: number;
  sharesRemaining?: number;
  wins?: number;
  places?: number;
  shows?: number;
  races?: number;
  earnings?: number;
  imageUrl?: string;
  description?: string;
  salePrice?: number;
  lifetimePastPerformanceUrl?: string;
  pedigreeUrl?: string;
  /** @deprecated Use sireId */
  sire?: string;
  /** @deprecated Use trainerId */
  trainer?: string;
  /** @deprecated Use jurisdictionIds */
  jurisdiction?: string[];
  /** @deprecated Use horseTypeId */
  horseType?: string;
}

export interface UpdateHorseRequest {
  name?: string;
  sireId?: string;
  dam?: string;
  sex?: HorseSex;
  age?: number;
  ageCategory?: HorseAgeCategory;
  gait?: HorseGait;
  status?: HorseStatus;
  isNew?: boolean;
  horseTypeId?: string;
  jurisdictionIds?: string[];
  trainerId?: string;
  stableLocation?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  pricePerPercent?: number;
  initialShares?: number;
  currentShares?: number;
  sharesRemaining?: number;
  wins?: number;
  places?: number;
  shows?: number;
  races?: number;
  earnings?: number;
  imageUrl?: string;
  description?: string;
  salePrice?: number;
  lifetimePastPerformanceUrl?: string;
  pedigreeUrl?: string;
  /** @deprecated Use sireId */
  sire?: string;
  /** @deprecated Use trainerId */
  trainer?: string;
  /** @deprecated Use jurisdictionIds */
  jurisdiction?: string[];
  /** @deprecated Use horseTypeId */
  horseType?: string;
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
  includeArchived?: boolean;
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
