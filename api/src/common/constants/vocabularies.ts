// Controlled vocabularies, mirroring the CHECK constraints in db/schema.sql.
// Codes are stored as-is; human-readable labels live in the frontend i18n.

export const SPECIES_CODES = [
  'cattle',
  'sheep',
  'goat',
  'pig',
  'horse',
  'other',
] as const;

export const SEX_CODES = ['male', 'female'] as const;

export const TENURE_CODES = ['owned', 'leased'] as const;

export const ANIMAL_STATUS_CODES = [
  'active',
  'sold',
  'dead',
  'culled',
  'transferred',
] as const;

export const HEALTH_EVENT_CODES = [
  'vaccination',
  'treatment',
  'deworming',
  'illness',
  'checkup',
  'other',
] as const;

export type Species = (typeof SPECIES_CODES)[number];
export type HealthEventType = (typeof HEALTH_EVENT_CODES)[number];
export type Sex = (typeof SEX_CODES)[number];
export type Tenure = (typeof TENURE_CODES)[number];
export type AnimalStatus = (typeof ANIMAL_STATUS_CODES)[number];
