import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnimal, useDeleteAnimal } from '@/features/animals/api';
import {
  HealthTab,
  NotesTab,
  WeightsTab,
} from '@/features/animals/records-tabs';
import { formatAge, formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/form';

function Attribute({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export default function AnimalDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const animal = useAnimal(id);
  const remove = useDeleteAnimal();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (animal.isPending) return <Skeleton className="h-64 w-full" />;
  if (animal.isError) {
    return <p className="text-destructive">{errorMessage(animal.error)}</p>;
  }
  const data = animal.data;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label={t('common.back')}>
          <Link to="/animals">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
          {data.tag ?? t('animals.noTag')}
        </h1>
        <StatusBadge status={data.status} />
        <div className="ms-auto flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/animals/${data.id}/edit`}>
              <Pencil className="size-4" /> {t('common.edit')}
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Attribute
              label={t('animals.species')}
              value={t(`vocab.species.${data.species}`)}
            />
            <Attribute
              label={t('animals.breed')}
              value={data.breed?.name ?? '—'}
            />
            <Attribute
              label={t('animals.sex')}
              value={t(`vocab.sex.${data.sex}`)}
            />
            <Attribute
              label={t('animals.age')}
              value={
                data.birth_date
                  ? `${formatAge(data.birth_date)} (${formatDate(data.birth_date)})`
                  : '—'
              }
            />
            <Attribute label={t('animals.farm')} value={data.farm.name} />
            <Attribute
              label={t('animals.tenure')}
              value={t(`vocab.tenure.${data.tenure}`)}
            />
            <Attribute
              label={t('animals.sire')}
              value={
                data.sire_id ? (
                  <Link
                    className="text-primary underline-offset-4 hover:underline"
                    to={`/animals/${data.sire_id}`}
                  >
                    {t('animals.viewParent')}
                  </Link>
                ) : (
                  '—'
                )
              }
            />
            <Attribute
              label={t('animals.dam')}
              value={
                data.dam_id ? (
                  <Link
                    className="text-primary underline-offset-4 hover:underline"
                    to={`/animals/${data.dam_id}`}
                  >
                    {t('animals.viewParent')}
                  </Link>
                ) : (
                  '—'
                )
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Tabs defaultValue="weights">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="weights">{t('records.weights')}</TabsTrigger>
          <TabsTrigger value="health">{t('records.health')}</TabsTrigger>
          <TabsTrigger value="notes">{t('records.notes')}</TabsTrigger>
        </TabsList>
        <TabsContent value="weights">
          <WeightsTab animalId={data.id} />
        </TabsContent>
        <TabsContent value="health">
          <HealthTab animalId={data.id} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab animalId={data.id} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('animals.deleteTitle')}
        description={t('animals.deleteDescription', { tag: data.tag ?? '' })}
        confirmLabel={t('common.delete')}
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () => {
              toast.success(t('animals.deleted'));
              void navigate('/animals');
            },
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
      />
    </>
  );
}
