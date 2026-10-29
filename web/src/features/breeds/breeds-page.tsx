import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { PaginationControls } from '@/components/pagination-controls';
import { VocabSelect } from '@/components/vocab-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreeds, useCreateBreed } from '@/features/breeds/api';
import type { Species } from '@/lib/api/types';
import { SPECIES_CODES } from '@/lib/api/types';
import { applyFieldErrors, errorMessage } from '@/lib/form';

interface BreedForm {
  species: Species | '';
  name: string;
}

function BreedDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const create = useCreateBreed();
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<BreedForm>({ defaultValues: { species: '', name: '' } });

  const onSubmit = handleSubmit((values) => {
    create.mutate(
      { species: values.species as Species, name: values.name },
      {
        onSuccess: () => {
          toast.success(t('breeds.created'));
          reset();
          onOpenChange(false);
        },
        onError: (error) => {
          if (!applyFieldErrors(error, setError)) {
            toast.error(errorMessage(error));
          }
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('breeds.newTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="breed-species">{t('breeds.species')}</Label>
            <Controller
              control={control}
              name="species"
              rules={{ required: t('validation.required') }}
              render={({ field }) => (
                <VocabSelect
                  id="breed-species"
                  className="w-full"
                  value={field.value || null}
                  onValueChange={(v) => field.onChange(v ?? '')}
                  codes={SPECIES_CODES}
                  prefix="vocab.species"
                  placeholder={t('common.select')}
                />
              )}
            />
            {errors.species && (
              <p className="text-sm text-destructive">
                {errors.species.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="breed-name">{t('breeds.name')}</Label>
            <Input
              id="breed-name"
              {...register('name', { required: t('validation.required') })}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BreedsPage() {
  const { t } = useTranslation();
  const [species, setSpecies] = useState<Species | undefined>();
  const [offset, setOffset] = useState(0);
  const breeds = useBreeds({ species, offset });
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <PageHeader title={t('nav.breeds')} count={breeds.data?.total}>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> {t('breeds.new')}
        </Button>
      </PageHeader>

      <div className="mb-4">
        <VocabSelect
          className="w-48"
          value={species ?? null}
          onValueChange={(v) => {
            setSpecies(v as Species | undefined);
            setOffset(0);
          }}
          codes={SPECIES_CODES}
          prefix="vocab.species"
          allLabel={t('breeds.allSpecies')}
        />
      </div>

      {breeds.isPending && <Skeleton className="h-40 w-full" />}
      {breeds.isError && (
        <p className="text-destructive">{errorMessage(breeds.error)}</p>
      )}

      {breeds.data && breeds.data.data.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t('breeds.empty')}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {breeds.data?.data.map((breed) => (
          <Card key={breed.id}>
            <CardContent>
              <p className="font-medium">{breed.name}</p>
              <p className="text-sm text-muted-foreground">
                {t(`vocab.species.${breed.species}`)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {breeds.data && (
        <PaginationControls
          total={breeds.data.total}
          limit={breeds.data.limit}
          offset={breeds.data.offset}
          onOffsetChange={setOffset}
        />
      )}

      <BreedDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
