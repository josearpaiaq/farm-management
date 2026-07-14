import { Plus } from 'lucide-react';
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { PaginationControls } from '@/components/pagination-controls';
import { StatusBadge } from '@/components/status-badge';
import { VocabSelect } from '@/components/vocab-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAnimals } from '@/features/animals/api';
import { useFarms } from '@/features/farms/api';
import {
  ANIMAL_STATUS_CODES,
  SEX_CODES,
  SPECIES_CODES,
} from '@/lib/api/types';
import { formatAge } from '@/lib/format';
import { errorMessage } from '@/lib/form';

const ALL_FARMS = '__all__';

// List filters and pagination live in the URL (see plan: nuqs for
// URL-synchronized state), so filtered views survive reload and can be shared.
const filterParams = {
  status: parseAsStringLiteral(ANIMAL_STATUS_CODES),
  species: parseAsStringLiteral(SPECIES_CODES),
  sex: parseAsStringLiteral(SEX_CODES),
  farm_id: parseAsString,
  offset: parseAsInteger.withDefault(0),
};

export default function AnimalsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filters, setFilters] = useQueryStates(filterParams);
  const farms = useFarms({ limit: 100 });
  const animals = useAnimals({
    status: filters.status ?? undefined,
    species: filters.species ?? undefined,
    sex: filters.sex ?? undefined,
    farm_id: filters.farm_id ?? undefined,
    offset: filters.offset,
  });

  return (
    <>
      <PageHeader title={t('nav.animals')} count={animals.data?.total}>
        <Button asChild>
          <Link to="/animals/new">
            <Plus className="size-4" /> {t('animals.new')}
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-2 md:flex md:flex-wrap">
        <VocabSelect
          className="md:w-40"
          value={filters.status}
          onValueChange={(v) =>
            void setFilters({
              status: (v ?? null) as typeof filters.status,
              offset: 0,
            })
          }
          codes={ANIMAL_STATUS_CODES}
          prefix="vocab.status"
          allLabel={t('animals.allStatuses')}
        />
        <VocabSelect
          className="md:w-40"
          value={filters.species}
          onValueChange={(v) =>
            void setFilters({
              species: (v ?? null) as typeof filters.species,
              offset: 0,
            })
          }
          codes={SPECIES_CODES}
          prefix="vocab.species"
          allLabel={t('animals.allSpecies')}
        />
        <VocabSelect
          className="md:w-36"
          value={filters.sex}
          onValueChange={(v) =>
            void setFilters({ sex: (v ?? null) as typeof filters.sex, offset: 0 })
          }
          codes={SEX_CODES}
          prefix="vocab.sex"
          allLabel={t('animals.allSexes')}
        />
        <Select
          value={filters.farm_id ?? ALL_FARMS}
          onValueChange={(v) =>
            void setFilters({ farm_id: v === ALL_FARMS ? null : v, offset: 0 })
          }
        >
          <SelectTrigger className="md:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FARMS}>{t('animals.allFarms')}</SelectItem>
            {farms.data?.data.map((farm) => (
              <SelectItem key={farm.id} value={farm.id}>
                {farm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {animals.isPending && <Skeleton className="h-64 w-full" />}
      {animals.isError && (
        <p className="text-destructive">{errorMessage(animals.error)}</p>
      )}

      {animals.data && animals.data.data.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t('animals.empty')}
          </CardContent>
        </Card>
      )}

      {animals.data && animals.data.data.length > 0 && (
        <>
          {/* Mobile: stacked cards (per approved animals-list mockup). */}
          <div className="space-y-2 md:hidden">
            {animals.data.data.map((animal) => (
              <Link
                key={animal.id}
                to={`/animals/${animal.id}`}
                className="block"
              >
                <Card>
                  <CardContent className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold tabular-nums">
                        {animal.tag ?? '—'}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {t(`vocab.species.${animal.species}`)}
                        {animal.breed ? ` · ${animal.breed.name}` : ''} ·{' '}
                        {animal.farm.name}
                      </p>
                    </div>
                    <StatusBadge status={animal.status} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop: table. */}
          <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('animals.tag')}</TableHead>
                  <TableHead>{t('animals.species')}</TableHead>
                  <TableHead>{t('animals.sex')}</TableHead>
                  <TableHead>{t('animals.age')}</TableHead>
                  <TableHead>{t('animals.farm')}</TableHead>
                  <TableHead>{t('animals.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {animals.data.data.map((animal) => (
                  <TableRow
                    key={animal.id}
                    className="cursor-pointer"
                    onClick={() => void navigate(`/animals/${animal.id}`)}
                  >
                    <TableCell className="font-semibold tabular-nums">
                      {animal.tag ?? '—'}
                    </TableCell>
                    <TableCell>
                      {t(`vocab.species.${animal.species}`)}
                      {animal.breed && (
                        <span className="text-muted-foreground">
                          {' '}
                          · {animal.breed.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{t(`vocab.sex.${animal.sex}`)}</TableCell>
                    <TableCell>{formatAge(animal.birth_date)}</TableCell>
                    <TableCell>{animal.farm.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={animal.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {animals.data && (
        <PaginationControls
          total={animals.data.total}
          limit={animals.data.limit}
          offset={animals.data.offset}
          onOffsetChange={(offset) => void setFilters({ offset })}
        />
      )}
    </>
  );
}
