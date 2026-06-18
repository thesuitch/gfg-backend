export interface StableUpdate {
  id: number;
  title: string;
  description: string;
  type: 'news' | 'activity';
  horseId: number | null;
  horseName: string | null;
  isGeneral: boolean;
  createdAt: string;
}

export interface CreateUpdateInput {
  title: string;
  description: string;
  type: 'news' | 'activity';
  horseId?: number | null;
  isGeneral: boolean;
}

export interface UpdateFilters {
  month?: number;
  year?: number;
  horseId?: number;
  memberHorseIds?: number[];
}
