// Helpers for parsing real-world CSV files, in particular what a
// Spanish-locale Excel export produces: BOM, semicolon separators, latin-1
// encoding, DD/MM/YYYY dates, and comma decimal separators (see plan).
import type { Sex, Species, Tenure } from '../common/constants/vocabularies';

export const SPECIES_SYNONYMS: Record<string, Species> = {
  cattle: 'cattle',
  bovino: 'cattle',
  sheep: 'sheep',
  ovino: 'sheep',
  oveja: 'sheep',
  goat: 'goat',
  caprino: 'goat',
  cabra: 'goat',
  pig: 'pig',
  porcino: 'pig',
  cerdo: 'pig',
  horse: 'horse',
  equino: 'horse',
  caballo: 'horse',
  other: 'other',
  otro: 'other',
};

export const SEX_SYNONYMS: Record<string, Sex> = {
  male: 'male',
  macho: 'male',
  m: 'male',
  female: 'female',
  hembra: 'female',
  f: 'female',
  h: 'female',
};

export const TENURE_SYNONYMS: Record<string, Tenure> = {
  owned: 'owned',
  propio: 'owned',
  propia: 'owned',
  leased: 'leased',
  arrendado: 'leased',
  arrendada: 'leased',
};

// Excel exports on Windows are often latin-1; a UTF-8 decode of latin-1
// bytes produces U+FFFD replacement characters, so their presence is the
// fallback signal.
export function decodeBuffer(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8');
  return utf8.includes('�') ? buffer.toString('latin1') : utf8;
}

export function detectDelimiter(text: string): ';' | ',' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const semicolons = firstLine.match(/;/g)?.length ?? 0;
  const commas = firstLine.match(/,/g)?.length ?? 0;
  return semicolons >= commas ? ';' : ',';
}

// Accepts DD/MM/YYYY (Spanish locale) or ISO YYYY-MM-DD; returns null when
// the value is not a real calendar date.
export function parseDate(value: string): Date | null {
  let year: number;
  let month: number;
  let day: number;

  const spanish = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (spanish) {
    [day, month, year] = [+spanish[1], +spanish[2], +spanish[3]];
  } else {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!iso) return null;
    [year, month, day] = [+iso[1], +iso[2], +iso[3]];
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return isReal ? date : null;
}

// Accepts "350.5", "350,5" and "1.234,5" (Spanish thousands separator).
export function parseDecimal(value: string): number | null {
  let normalized = value.trim();
  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}
