import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimalForm } from '@/features/animals/animal-form';
import { useAnimal, useUpdateAnimal } from '@/features/animals/api';
import { errorMessage } from '@/lib/form';

export default function AnimalEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const animal = useAnimal(id);
  const update = useUpdateAnimal();

  if (animal.isPending) return <Skeleton className="h-64 w-full" />;
  if (animal.isError) {
    return <p className="text-destructive">{errorMessage(animal.error)}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('animals.editTitle', { tag: animal.data.tag ?? '' })}
      />
      <AnimalForm
        animal={animal.data}
        pending={update.isPending}
        onSubmit={(input, onError) =>
          update.mutate(
            { id: animal.data.id, ...input },
            {
              onSuccess: () => {
                toast.success(t('animals.updated'));
                void navigate(`/animals/${animal.data.id}`);
              },
              onError,
            },
          )
        }
      />
    </>
  );
}
