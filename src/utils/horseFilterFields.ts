import {
  CreateHorseRequest,
  UpdateHorseRequest,
} from '../types/horse';

/** Map API ID fields to DB columns (sire, trainer, jurisdiction store filter option IDs). */
export function normalizeHorseWritePayload<T extends CreateHorseRequest | UpdateHorseRequest>(
  data: T
): Omit<T, 'sireId' | 'trainerId' | 'jurisdictionIds' | 'horseTypeId'> & {
  sire?: string;
  trainer?: string | null;
  jurisdiction?: string[];
  horseType?: string;
} {
  const normalized = { ...data } as Record<string, unknown>;

  if (data.sireId !== undefined) {
    normalized.sire = data.sireId;
  } else if (data.sire !== undefined) {
    normalized.sire = data.sire;
  }

  if (data.trainerId !== undefined) {
    normalized.trainer = data.trainerId || null;
  } else if (data.trainer !== undefined) {
    normalized.trainer = data.trainer;
  }

  if (data.jurisdictionIds !== undefined) {
    normalized.jurisdiction = data.jurisdictionIds;
  } else if (data.jurisdiction !== undefined) {
    normalized.jurisdiction = Array.isArray(data.jurisdiction)
      ? data.jurisdiction
      : [data.jurisdiction];
  }

  if (data.horseTypeId !== undefined) {
    normalized.horseType = data.horseTypeId;
  } else if (data.horseType !== undefined) {
    normalized.horseType = data.horseType;
  }

  delete normalized.sireId;
  delete normalized.trainerId;
  delete normalized.jurisdictionIds;
  delete normalized.horseTypeId;

  return normalized as ReturnType<typeof normalizeHorseWritePayload>;
}

export function mapHorseRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    sireId: row.sireId ?? row.sire ?? '',
    trainerId: row.trainerId ?? row.trainer ?? undefined,
    jurisdictionIds: row.jurisdictionIds ?? row.jurisdiction ?? [],
    horseTypeId: row.horseTypeId ?? row.horseType ?? '',
  };
}
