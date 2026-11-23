import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { VocabSelect } from '@/components/vocab-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AnimalInput } from '@/features/animals/api';
import { useAnimals } from '@/features/animals/api';
import { useBreeds } from '@/features/breeds/api';
import { useFarms } from '@/features/farms/api';
import type { Animal, AnimalStatus, Sex, Species, Tenure } from '@/lib/api/types';
import {
  ANIMAL_STATUS_CODES,
  SEX_CODES,
  SPECIES_CODES,
  TENURE_CODES,
} from '@/lib/api/types';
import { applyFieldErrors, errorMessage } from '@/lib/form';

const NONE = '__none__';

interface AnimalFormValues {
  tag: string;
  species: Species | '';
  sex: Sex | '';
  farm_id: string;
  breed_id: string;
  birth_date: string;
  tenure: Tenure;
  status: AnimalStatus;
  sire_id: string;
  dam_id: string;
}

function toInput(values: AnimalFormValues): AnimalInput {
  return {
    tag: values.tag,
    species: values.species as Species,
    sex: values.sex as Sex,
    farm_id: values.farm_id,
    breed_id: values.breed_id || undefined,
    birth_date: values.birth_date || undefined,
    tenure: values.tenure,
    status: values.status,
    sire_id: values.sire_id || undefined,
    dam_id: values.dam_id || undefined,
  };
}

// One field with label + error, to keep the grid below readable.
function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function AnimalForm({
  animal,
  pending,
  onSubmit,
}: {
  animal?: Animal;
  pending: boolean;
  onSubmit: (
    input: AnimalInput,
    onError: (error: Error) => boolean,
  ) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<AnimalFormValues>({
    defaultValues: {
      tag: animal?.tag ?? '',
      species: animal?.species ?? '',
      sex: animal?.sex ?? '',
      farm_id: animal?.farm_id ?? '',
      breed_id: animal?.breed_id ?? '',
      birth_date: animal?.birth_date?.slice(0, 10) ?? '',
      tenure: animal?.tenure ?? 'owned',
      status: animal?.status ?? 'active',
      sire_id: animal?.sire_id ?? '',
      dam_id: animal?.dam_id ?? '',
    },
  });

  const species = watch('species');
  const farms = useFarms({ limit: 100 });
  const breeds = useBreeds(
    species ? { species: species as Species, limit: 100 } : { limit: 100 },
  );
  // Parent pickers: same species, right sex (validated server-side too).
  const sires = useAnimals(
    { species: species as Species, sex: 'male', limit: 100 },
    { enabled: Boolean(species) },
  );
  const dams = useAnimals(
    { species: species as Species, sex: 'female', limit: 100 },
    { enabled: Boolean(species) },
  );

  const submit = handleSubmit((values) => {
    onSubmit(toInput(values), (error) => {
      if (applyFieldErrors(error, setError)) return true;
      toast.error(errorMessage(error));
      return true;
    });
  });

  const parentOptions = (list: typeof sires) =>
    list.data?.data.filter((a) => a.id !== animal?.id) ?? [];

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('animals.tag')}
          htmlFor="animal-tag"
          error={errors.tag?.message}
        >
          <Input
            id="animal-tag"
            {...register('tag', { required: t('validation.required') })}
          />
        </Field>

        <Field
          label={t('animals.farm')}
          htmlFor="animal-farm"
          error={errors.farm_id?.message}
        >
          <Controller
            control={control}
            name="farm_id"
            rules={{ required: t('validation.required') }}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="animal-farm" className="w-full">
                  <SelectValue placeholder={t('common.select')} />
                </SelectTrigger>
                <SelectContent>
                  {farms.data?.data.map((farm) => (
                    <SelectItem key={farm.id} value={farm.id}>
                      {farm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field
          label={t('animals.species')}
          htmlFor="animal-species"
          error={errors.species?.message}
        >
          <Controller
            control={control}
            name="species"
            rules={{ required: t('validation.required') }}
            render={({ field }) => (
              <VocabSelect
                id="animal-species"
                className="w-full"
                value={field.value || null}
                onValueChange={(v) => {
                  field.onChange(v ?? '');
                  // Breed and parents are species-scoped.
                  setValue('breed_id', '');
                  setValue('sire_id', '');
                  setValue('dam_id', '');
                }}
                codes={SPECIES_CODES}
                prefix="vocab.species"
                placeholder={t('common.select')}
              />
            )}
          />
        </Field>

        <Field
          label={t('animals.sex')}
          htmlFor="animal-sex"
          error={errors.sex?.message}
        >
          <Controller
            control={control}
            name="sex"
            rules={{ required: t('validation.required') }}
            render={({ field }) => (
              <VocabSelect
                id="animal-sex"
                className="w-full"
                value={field.value || null}
                onValueChange={(v) => field.onChange(v ?? '')}
                codes={SEX_CODES}
                prefix="vocab.sex"
                placeholder={t('common.select')}
              />
            )}
          />
        </Field>

        <Field
          label={t('animals.breed')}
          htmlFor="animal-breed"
          error={errors.breed_id?.message}
        >
          <Controller
            control={control}
            name="breed_id"
            render={({ field }) => (
              <Select
                value={field.value || NONE}
                onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                disabled={!species}
              >
                <SelectTrigger id="animal-breed" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('common.none')}</SelectItem>
                  {breeds.data?.data.map((breed) => (
                    <SelectItem key={breed.id} value={breed.id}>
                      {breed.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field
          label={t('animals.birthDate')}
          htmlFor="animal-birth-date"
          error={errors.birth_date?.message}
        >
          <Input id="animal-birth-date" type="date" {...register('birth_date')} />
        </Field>

        <Field
          label={t('animals.tenure')}
          htmlFor="animal-tenure"
          error={errors.tenure?.message}
        >
          <Controller
            control={control}
            name="tenure"
            render={({ field }) => (
              <VocabSelect
                id="animal-tenure"
                className="w-full"
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? 'owned')}
                codes={TENURE_CODES}
                prefix="vocab.tenure"
              />
            )}
          />
        </Field>

        <Field
          label={t('animals.status')}
          htmlFor="animal-status"
          error={errors.status?.message}
        >
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <VocabSelect
                id="animal-status"
                className="w-full"
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? 'active')}
                codes={ANIMAL_STATUS_CODES}
                prefix="vocab.status"
              />
            )}
          />
        </Field>

        <Field
          label={t('animals.sire')}
          htmlFor="animal-sire"
          error={errors.sire_id?.message}
        >
          <Controller
            control={control}
            name="sire_id"
            render={({ field }) => (
              <Select
                value={field.value || NONE}
                onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                disabled={!species}
              >
                <SelectTrigger id="animal-sire" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('common.none')}</SelectItem>
                  {parentOptions(sires).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.tag ?? a.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field
          label={t('animals.dam')}
          htmlFor="animal-dam"
          error={errors.dam_id?.message}
        >
          <Controller
            control={control}
            name="dam_id"
            render={({ field }) => (
              <Select
                value={field.value || NONE}
                onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                disabled={!species}
              >
                <SelectTrigger id="animal-dam" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('common.none')}</SelectItem>
                  {parentOptions(dams).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.tag ?? a.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
