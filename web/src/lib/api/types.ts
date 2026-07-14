// Types mirroring the API contract (snake_case, see api/ DTOs and services).
// Codes come from the controlled vocabularies enforced by the DB CHECK
// constraints; human-readable labels live in i18n (see plan, Data Model).

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
export type Sex = (typeof SEX_CODES)[number];
export type Tenure = (typeof TENURE_CODES)[number];
export type AnimalStatus = (typeof ANIMAL_STATUS_CODES)[number];
export type HealthEventType = (typeof HEALTH_EVENT_CODES)[number];

export interface Paginated<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization_id: string;
}

export interface AuthResponse {
  user: AuthUser;
  csrf_token: string;
}

export interface Farm {
  id: string;
  name: string;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface Breed {
  id: string;
  species: Species;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface AnimalRef {
  id: string;
  name: string;
}

export interface AnimalListItem {
  id: string;
  farm_id: string;
  species: Species;
  sex: Sex;
  breed_id: string | null;
  birth_date: string | null;
  tenure: Tenure;
  status: AnimalStatus;
  sire_id: string | null;
  dam_id: string | null;
  created_at: string;
  updated_at: string;
  tag: string | null;
  breed: AnimalRef | null;
  farm: AnimalRef;
}

export interface AnimalIdentifier {
  id: string;
  id_type: string;
  value: string;
  is_primary: boolean;
}

export interface Animal extends AnimalListItem {
  identifiers: AnimalIdentifier[];
}

export interface HerdStats {
  total: number;
  by_status: Partial<Record<AnimalStatus, number>>;
  by_species: Partial<Record<Species, number>>;
}

export interface WeightRecord {
  id: string;
  // numeric column; Prisma Decimal serializes to a JSON string.
  weight_kg: string;
  recorded_on: string;
  created_at: string;
}

export interface HealthEvent {
  id: string;
  event_type: HealthEventType;
  occurred_on: string;
  product: string | null;
  description: string | null;
  withdrawal_until: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  body: string;
  created_at: string;
}

export interface ImportJob {
  id: string;
  filename: string;
  dry_run: boolean;
  status: string;
  total_rows: number | null;
  ok_rows: number | null;
  error_rows: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ImportRowStatus =
  | 'valid'
  | 'invalid'
  | 'imported'
  | 'skipped'
  | 'error';

export interface ImportRowResult {
  row_number: number;
  status: ImportRowStatus;
  message: string | null;
  animal_id: string | null;
}

export interface ImportJobDetail extends ImportJob {
  import_row_results: ImportRowResult[];
}

export interface ImportResponse {
  job: ImportJob;
  summary: {
    total: number;
    valid?: number;
    imported?: number;
    skipped: number;
    errors: number;
  };
  results: ImportRowResult[];
}
