import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  useMe,
  useRequestLoginCode,
  useVerifyLoginCode,
} from '@/features/auth/api';
import {
  AuthField,
  AuthLink,
  AuthShell,
  FormError,
} from '@/features/auth/auth-shell';
import { codeErrorMessage, codeRules } from '@/features/auth/code-rules';
import { errorMessage } from '@/lib/form';

// Passwordless login: ask for the email, then for the code sent to it.
export default function CodeLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const requestCode = useRequestLoginCode();
  const verify = useVerifyLoginCode();
  const [email, setEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string; code: string }>();

  if (me.data) return <Navigate to="/" replace />;

  const onSubmit = handleSubmit((values) => {
    if (email === null) {
      requestCode.mutate(
        { email: values.email },
        { onSuccess: () => setEmail(values.email) },
      );
      return;
    }
    verify.mutate(
      { email, code: values.code },
      { onSuccess: () => navigate('/', { replace: true }) },
    );
  });

  return (
    <AuthShell
      subtitle={
        email === null
          ? t('auth.loginWithCodeSubtitle')
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
            {requestCode.isError && (
              <FormError message={errorMessage(requestCode.error)} />
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={requestCode.isPending}
            >
              {requestCode.isPending ? t('common.loading') : t('auth.sendCode')}
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
            {verify.isError && <FormError message={codeErrorMessage(verify.error, t)} />}
            <Button type="submit" className="w-full" disabled={verify.isPending}>
              {verify.isPending ? t('common.loading') : t('auth.login')}
            </Button>
          </>
        )}
      </form>
    </AuthShell>
  );
}
