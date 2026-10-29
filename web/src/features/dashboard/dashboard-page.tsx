import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useHerdStats } from '@/features/animals/api';
import type { AnimalStatus } from '@/lib/api/types';
import { ANIMAL_STATUS_CODES, SPECIES_CODES } from '@/lib/api/types';
import { errorMessage } from '@/lib/form';
import { cn } from '@/lib/utils';

const numberFormat = new Intl.NumberFormat('es');

const STATUS_DOT: Record<AnimalStatus, string> = {
  active: 'bg-status-active',
  sold: 'bg-status-inactive',
  transferred: 'bg-status-inactive',
  culled: 'bg-status-warning',
  dead: 'bg-status-danger',
};

// Count rows link to the animals list pre-filtered to that segment. Counts
// stay in text ink (tabular figures); the dot alone carries the status color,
// always next to its label.
function CountRow({
  to,
  label,
  count,
  dotClass,
}: {
  to: string;
  label: string;
  count: number;
  dotClass?: string;
}) {
  return (
    <Link
      to={to}
      className="-mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
    >
      <span className="flex items-center gap-2">
        {dotClass && (
          <span
            className={cn('size-2.5 shrink-0 rounded-full', dotClass)}
            aria-hidden
          />
        )}
        {label}
      </span>
      <span
        className={cn(
          'font-medium tabular-nums',
          count === 0 && 'text-muted-foreground',
        )}
      >
        {numberFormat.format(count)}
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const stats = useHerdStats();

  if (stats.isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 md:col-span-2" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (stats.isError) {
    return <p className="text-destructive">{errorMessage(stats.error)}</p>;
  }
  const data = stats.data;
  const speciesPresent = SPECIES_CODES.filter(
    (code) => (data.by_species[code] ?? 0) > 0,
  );

  return (
    <>
      <PageHeader title={t('nav.dashboard')} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardContent className="py-6 text-center">
            <p className="text-5xl font-semibold tabular-nums tracking-tight">
              {numberFormat.format(data.total)}
            </p>
            <p className="mt-1 text-muted-foreground">
              {t('dashboard.totalAnimals')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('dashboard.byStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {ANIMAL_STATUS_CODES.map((status) => (
              <CountRow
                key={status}
                to={`/animals?status=${status}`}
                label={t(`vocab.status.${status}`)}
                count={data.by_status[status] ?? 0}
                dotClass={STATUS_DOT[status]}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('dashboard.bySpecies')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {speciesPresent.length === 0 && (
              <p className="py-4 text-center text-muted-foreground">
                {t('dashboard.noAnimals')}
              </p>
            )}
            {speciesPresent.map((species) => (
              <CountRow
                key={species}
                to={`/animals?species=${species}`}
                label={t(`vocab.species.${species}`)}
                count={data.by_species[species] ?? 0}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
