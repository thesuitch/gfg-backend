export const HORSE_STATUSES = ['active', 'retired', 'sold', 'inactive'] as const;
export const HORSE_TYPES = [
  'standardbred',
  'thoroughbred',
  'quarter_horse',
  'arabian',
  'other',
  'Yearling/Baby',
  'Stakes Racehorse',
  'Conditioned Racehorse',
] as const;
export const HORSE_AGE_CATEGORIES = ['1YO', '2YO', '3YO', '4YO', '4YO+', '5YO', '6YO', '7YO', '8YO+'] as const;
export const HORSE_SEXES = ['colt', 'filly', 'gelding', 'mare', 'stallion'] as const;
export const HORSE_GAITS = ['trotter', 'pacer'] as const;

export const isValidHorseImageUrl = (value: unknown): boolean => {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  if (value.startsWith('data:image/')) return true;
  if (value.startsWith('/')) return true;
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
};
