import type { TFunction } from 'i18next';
import { ApiError } from '@/lib/api/client';
import { errorMessage } from '@/lib/form';

// react-hook-form rules for the 6-digit emailed code.
export const codeRules = (t: TFunction) => ({
  required: t('validation.required'),
  pattern: { value: /^\d{6}$/, message: t('auth.codeFormat') },
});

// A 401 on a code check means a wrong, expired or used-up code.
export const codeErrorMessage = (error: unknown, t: TFunction) =>
  error instanceof ApiError && error.status === 401
    ? t('auth.invalidCode')
    : errorMessage(error);
