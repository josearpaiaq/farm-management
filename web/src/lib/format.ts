// Date-only API fields arrive as ISO strings at UTC midnight; parsing the
// date part locally avoids the off-by-one-day shift in western timezones.
export function parseDateOnly(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Today's date in the user's timezone (toISOString would give UTC, which
// jumps to tomorrow during the evening west of Greenwich).
export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const dateFormat = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return dateFormat.format(parseDateOnly(iso));
}

const weightFormat = new Intl.NumberFormat('es', {
  maximumFractionDigits: 2,
});

export function formatWeightKg(value: string | number): string {
  return `${weightFormat.format(Number(value))} kg`;
}

// Age derived from birth_date (see plan, Data Model): years when >= 1,
// months below that.
export function formatAge(birthDate: string | null): string {
  if (!birthDate) return '—';
  const birth = parseDateOnly(birthDate);
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    now.getMonth() -
    birth.getMonth() -
    (now.getDate() < birth.getDate() ? 1 : 0);
  if (months < 0) return '—';
  if (months < 12) return `${months} m`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest > 0 ? `${years} a ${rest} m` : `${years} a`;
}
