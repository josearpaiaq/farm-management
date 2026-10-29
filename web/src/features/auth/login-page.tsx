import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLogin, useMe } from '@/features/auth/api';
import {
  AuthField,
  AuthLink,
  AuthShell,
  FormError,
} from '@/features/auth/auth-shell';
import { ApiError } from '@/lib/api/client';
import { errorMessage } from '@/lib/form';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  if (me.data) return <Navigate to="/" replace />;

  // 403: right password, unverified email. The API already sent a code.
  const isUnverified = (error: unknown) =>
    error instanceof ApiError && error.status === 403;

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => navigate('/', { replace: true }),
      onError: (error) => {
        if (isUnverified(error)) {
          navigate(`/verify-email?email=${encodeURIComponent(values.email)}`);
        }
      },
    });
  });

  return (
    <AuthShell
      subtitle={t('auth.subtitle')}
      footer={
        <>
          <AuthLink to="/login/code">{t('auth.loginWithCode')}</AuthLink>
          <AuthLink to="/forgot-password">{t('auth.forgotPassword')}</AuthLink>
          <AuthLink to="/register">{t('auth.noAccount')}</AuthLink>
        </>
      }
    >
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-4"
        noValidate
      >
        <AuthField
          id="email"
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          autoFocus
          error={errors.email?.message}
          {...register('email', { required: t('validation.required') })}
        />
        <AuthField
          id="password"
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password', { required: t('validation.required') })}
        />
        {login.isError && !isUnverified(login.error) && (
          <FormError message={errorMessage(login.error)} />
        )}
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? t('common.loading') : t('auth.login')}
        </Button>
      </form>
    </AuthShell>
  );
}
