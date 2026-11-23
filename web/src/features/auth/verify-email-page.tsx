import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useResendVerification, useVerifyEmail } from '@/features/auth/api';
import {
  AuthField,
  AuthLink,
  AuthShell,
  FormError,
} from '@/features/auth/auth-shell';
import { codeErrorMessage, codeRules } from '@/features/auth/code-rules';
import { errorMessage } from '@/lib/form';

// Reached after sign-up, or after a password login on an unverified email.
export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const email = useSearchParams()[0].get('email') ?? '';
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ code: string }>();

  if (!email) return <Navigate to="/register" replace />;

  const onSubmit = handleSubmit(({ code }) => {
    verify.mutate(
      { email, code },
      { onSuccess: () => navigate('/', { replace: true }) },
    );
  });

  return (
    <AuthShell
      subtitle={t('auth.codeSentTo', { email })}
      footer={<AuthLink to="/login">{t('auth.backToLogin')}</AuthLink>}
    >
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-4"
        noValidate
      >
        <AuthField
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
          {verify.isPending ? t('common.loading') : t('auth.verify')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={resend.isPending}
          onClick={() => resend.mutate({ email })}
        >
          {resend.isSuccess ? t('auth.codeResent') : t('auth.resendCode')}
        </Button>
        {resend.isError && <FormError message={errorMessage(resend.error)} />}
      </form>
    </AuthShell>
  );
}
