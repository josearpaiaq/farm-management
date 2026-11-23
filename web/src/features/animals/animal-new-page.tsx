import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { AnimalForm } from '@/features/animals/animal-form';
import { useCreateAnimal } from '@/features/animals/api';

export default function AnimalNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateAnimal();

  return (
    <>
      <PageHeader title={t('animals.newTitle')} />
      <AnimalForm
        pending={create.isPending}
        onSubmit={(input, onError) =>
          create.mutate(input, {
            onSuccess: (animal) => {
              toast.success(t('animals.created'));
              void navigate(`/animals/${animal.id}`);
            },
            onError,
          })
        }
      />
    </>
  );
}
