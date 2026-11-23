import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useForgotPassword, useResetPassword } from '@/features/auth/api';
import {
  AuthField,
  AuthLink,
  AuthShell,
  FormError,
} from '@/features/auth/auth-shell';
import { codeErrorMessage, codeRules } from '@/features/auth/code-rules';
import { errorMessage } from '@/lib/form';

interface ForgotForm {
  email: string;
  code: string;
  password: string;
}

// Password recovery: ask for the email, then for the code plus a new password.
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const forgot = useForgotPassword();
  const reset = useResetPassword();
  const [email, setEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>();

  const onSubmit = handleSubmit((values) => {
    if (email === null) {
      forgot.mutate(
        { email: values.email },
        { onSuccess: () => setEmail(values.email) },
      );
      return;
    }
    reset.mutate(
      { email, code: values.code, password: values.password },
      { onSuccess: () => navigate('/', { replace: true }) },
    );
  });

  return (
    <AuthShell
      subtitle={
        email === null
          ? t('auth.forgotSubtitle')
          : t('auth.codeSentTo', { email })
      }
      footer={<AuthLink to="/login">{t('auth.backToLogin')}</AuthLink>}
    >
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-4"
        noValidate
      >
        {email === null ? (
          <>
            <AuthField
              key="email"
              id="email"
              label={t('auth.email')}
              type="email"
              autoComplete="email"
              autoFocus
              error={errors.email?.message}
              {...register('email', { required: t('validation.required') })}
            />
            {forgot.isError && <FormError message={errorMessage(forgot.error)} />}
            <Button type="submit" className="w-full" disabled={forgot.isPending}>
              {forgot.isPending ? t('common.loading') : t('auth.sendCode')}
            </Button>
          </>
        ) : (
          <>
            <AuthField
              key="code"
              id="code"
              label={t('auth.code')}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              error={errors.code?.message}
              {...register('code', codeRules(t))}
            />
            <AuthField
              id="password"
              label={t('auth.newPassword')}
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password', {
                required: t('validation.required'),
                minLength: { value: 8, message: t('auth.passwordMin') },
              })}
            />
            {reset.isError && <FormError message={codeErrorMessage(reset.error, t)} />}
            <Button type="submit" className="w-full" disabled={reset.isPending}>
              {reset.isPending ? t('common.loading') : t('auth.resetPassword')}
            </Button>
          </>
        )}
      </form>
    </AuthShell>
  );
}
