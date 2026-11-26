import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
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
  first_name: string;
  last_name: string;
  organization_name: string;
  email: string;
  password: string;
}

// Signing up always creates a new organization. People joining an existing
// one don't sign up: the owner invites them, which creates their account.
type Step = 'choose' | 'create' | 'join';

export default function RegisterPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('choose');
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

  const footer = <AuthLink to="/login">{t('auth.haveAccount')}</AuthLink>;

  if (step === 'choose') {
    return (
      <AuthShell subtitle={t('auth.registerChoice')} footer={footer}>
        <Button className="w-full" onClick={() => setStep('create')}>
          {t('auth.createOrganization')}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setStep('join')}
        >
          {t('auth.joinOrganization')}
        </Button>
      </AuthShell>
    );
  }

  if (step === 'join') {
    return (
      <AuthShell subtitle={t('auth.joinOrganization')} footer={footer}>
        <p className="text-sm text-muted-foreground">{t('auth.joinHelp')}</p>
        <Button asChild className="w-full">
          <Link to="/login/code">{t('auth.loginWithCode')}</Link>
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setStep('choose')}
        >
          {t('common.back')}
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle={t('auth.registerSubtitle')} footer={footer}>
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-4"
        noValidate
      >
        <AuthField
          id="first_name"
          label={t('auth.firstName')}
          autoComplete="given-name"
          autoFocus
          error={errors.first_name?.message}
          {...register('first_name', required)}
        />
        <AuthField
          id="last_name"
          label={t('auth.lastName')}
          autoComplete="family-name"
          error={errors.last_name?.message}
          {...register('last_name', required)}
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
