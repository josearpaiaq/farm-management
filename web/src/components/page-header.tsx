import type { ReactNode } from 'react';

// List-page header per the approved animals-list mockup: title with the
// entity count ("Animales · 42") and the primary action on the right.
export function PageHeader({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        {title}
        {count !== undefined && (
          <span className="text-muted-foreground font-normal"> · {count}</span>
        )}
      </h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
