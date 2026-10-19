import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Centered card layout shared by all signed-out pages.
export function AuthShell({
  subtitle,
  children,
  footer,
}: {
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {t('app.title')}
          </h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
        </header>
        <div className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          {children}
        </div>
        {footer && (
          <div className="mt-4 space-y-2 text-center text-sm">{footer}</div>
        )}
      </div>
    </main>
  );
}

export function AuthField({
  id,
  label,
  error,
  ...inputProps
}: ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={!!error} {...inputProps} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="block text-primary hover:underline">
      {children}
    </Link>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
