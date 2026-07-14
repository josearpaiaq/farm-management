import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin, useMe } from '@/features/auth/api';
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

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, { onSuccess: () => navigate('/', { replace: true }) });
  });

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {t('app.title')}
          </h1>
          <p className="mt-2 text-muted-foreground">{t('auth.subtitle')}</p>
        </header>
        <form
          onSubmit={(event) => void onSubmit(event)}
          className="space-y-4 rounded-lg border bg-card p-6 shadow-sm"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              {...register('email', { required: t('validation.required') })}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password', { required: t('validation.required') })}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          {login.isError && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage(login.error)}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? t('common.loading') : t('auth.login')}
          </Button>
        </form>
      </div>
    </main>
  );
}
