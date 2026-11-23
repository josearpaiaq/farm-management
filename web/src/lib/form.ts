import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import i18n from '@/i18n';
import { ApiError } from '@/lib/api/client';

// Maps the API's 422 field-level details onto react-hook-form errors.
// Returns true when the error was consumed as field errors.
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!(error instanceof ApiError) || !error.details?.length) return false;
  for (const detail of error.details) {
    setError(detail.field as Path<T>, { message: detail.message });
  }
  return true;
}

// User-facing message for an API failure: the error code resolves to a
// Spanish message; unknown codes fall back to the server's message.
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const key = `errors.${error.code}`;
    return i18n.exists(key) ? i18n.t(key) : error.message;
  }
  return i18n.t('errors.network');
}
