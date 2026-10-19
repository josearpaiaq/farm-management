import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useMe, useRegister } from '@/features/auth/api';
import {
  AuthField,
  AuthLink,
  AuthShell,
  FormError,
} from '@/features/auth/auth-shell';
import { ApiError } from '@/lib/api/client';
import { applyFieldErrors, errorMessage } from '@/lib/form';

interface RegisterForm {
  full_name: string;
  organization_name: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const signUp = useRegister();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>();

  if (me.data) return <Navigate to="/" replace />;

  const required = { required: t('validation.required') };

  const onSubmit = handleSubmit((values) => {
    signUp.mutate(values, {
      onSuccess: () =>
        navigate(`/verify-email?email=${encodeURIComponent(values.email)}`),
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          setError('email', { message: t('auth.emailTaken') });
          return;
        }
        applyFieldErrors(error, setError);
      },
    });
  });

  const generalError =
    signUp.isError &&
    !(signUp.error instanceof ApiError && signUp.error.details?.length) &&
    !(signUp.error instanceof ApiError && signUp.error.status === 409);

  return (
    <AuthShell
      subtitle={t('auth.registerSubtitle')}
      footer={<AuthLink to="/login">{t('auth.haveAccount')}</AuthLink>}
    >
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-4"
        noValidate
      >
        <AuthField
          id="full_name"
          label={t('auth.fullName')}
          autoComplete="name"
          autoFocus
          error={errors.full_name?.message}
          {...register('full_name', required)}
        />
        <AuthField
          id="organization_name"
          label={t('auth.organizationName')}
          autoComplete="organization"
          error={errors.organization_name?.message}
          {...register('organization_name', required)}
        />
        <AuthField
          id="email"
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email', required)}
        />
        <AuthField
          id="password"
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password', {
            ...required,
            minLength: { value: 8, message: t('auth.passwordMin') },
          })}
        />
        {generalError && <FormError message={errorMessage(signUp.error)} />}
        <Button type="submit" className="w-full" disabled={signUp.isPending}>
          {signUp.isPending ? t('common.loading') : t('auth.register')}
        </Button>
      </form>
    </AuthShell>
  );
}
