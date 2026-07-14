import { Trash2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { VocabSelect } from '@/components/vocab-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { HealthEventInput, WeightInput } from '@/features/animals/api';
import {
  healthEventsApi,
  notesApi,
  weightsApi,
} from '@/features/animals/api';
import { HEALTH_EVENT_CODES } from '@/lib/api/types';
import {
  formatDate,
  formatWeightKg,
  parseDateOnly,
  todayISO as today,
} from '@/lib/format';
import { applyFieldErrors, errorMessage } from '@/lib/form';

function RecordRow({
  children,
  onDelete,
  deleteLabel,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  deleteLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 border-b py-3 last:border-b-0">
      <div className="min-w-0 flex-1">{children}</div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={deleteLabel}
        onClick={onDelete}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}

export function WeightsTab({ animalId }: { animalId: string }) {
  const { t } = useTranslation();
  const list = weightsApi.useList(animalId);
  const add = weightsApi.useAdd(animalId);
  const remove = weightsApi.useRemove(animalId);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<{ weight_kg: string; recorded_on: string }>({
    defaultValues: { weight_kg: '', recorded_on: today() },
  });

  const onSubmit = handleSubmit((values) => {
    const input: WeightInput = {
      weight_kg: Number(values.weight_kg),
      recorded_on: values.recorded_on,
    };
    add.mutate(input, {
      onSuccess: () => {
        toast.success(t('records.weightAdded'));
        reset({ weight_kg: '', recorded_on: values.recorded_on });
      },
      onError: (error) => {
        if (!applyFieldErrors(error, setError)) toast.error(errorMessage(error));
      },
    });
  });

  return (
    <Card>
      <CardContent>
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mb-4 grid grid-cols-2 items-end gap-2 sm:flex"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="weight-kg">{t('records.weightKg')}</Label>
            <Input
              id="weight-kg"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              className="sm:w-32"
              {...register('weight_kg', { required: t('validation.required') })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight-date">{t('records.date')}</Label>
            <Input
              id="weight-date"
              type="date"
              className="sm:w-44"
              {...register('recorded_on', { required: t('validation.required') })}
            />
          </div>
          <Button
            type="submit"
            disabled={add.isPending}
            className="col-span-2 sm:col-span-1"
          >
            {t('records.addWeight')}
          </Button>
        </form>
        {(errors.weight_kg ?? errors.recorded_on) && (
          <p className="mb-2 text-sm text-destructive">
            {errors.weight_kg?.message ?? errors.recorded_on?.message}
          </p>
        )}

        {list.isPending && <Skeleton className="h-24 w-full" />}
        {list.data?.data.length === 0 && (
          <p className="py-4 text-center text-muted-foreground">
            {t('records.noWeights')}
          </p>
        )}
        {list.data?.data.map((record) => (
          <RecordRow
            key={record.id}
            deleteLabel={t('common.delete')}
            onDelete={() =>
              remove.mutate(record.id, {
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            <p className="font-medium tabular-nums">
              {formatWeightKg(record.weight_kg)}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDate(record.recorded_on)}
            </p>
          </RecordRow>
        ))}
      </CardContent>
    </Card>
  );
}

export function HealthTab({ animalId }: { animalId: string }) {
  const { t } = useTranslation();
  const list = healthEventsApi.useList(animalId);
  const add = healthEventsApi.useAdd(animalId);
  const remove = healthEventsApi.useRemove(animalId);
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<{
    event_type: string;
    occurred_on: string;
    product: string;
    description: string;
    withdrawal_until: string;
  }>({
    defaultValues: {
      event_type: '',
      occurred_on: today(),
      product: '',
      description: '',
      withdrawal_until: '',
    },
  });

  const onSubmit = handleSubmit((values) => {
    const input: HealthEventInput = {
      event_type: values.event_type,
      occurred_on: values.occurred_on,
      product: values.product || undefined,
      description: values.description || undefined,
      withdrawal_until: values.withdrawal_until || undefined,
    };
    add.mutate(input, {
      onSuccess: () => {
        toast.success(t('records.healthAdded'));
        reset();
      },
      onError: (error) => {
        if (!applyFieldErrors(error, setError)) toast.error(errorMessage(error));
      },
    });
  });

  const withdrawalActive = (until: string | null) =>
    until !== null && parseDateOnly(until) >= new Date();

  return (
    <Card>
      <CardContent>
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mb-4 grid gap-3 sm:grid-cols-2"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="health-type">{t('records.eventType')}</Label>
            <Controller
              control={control}
              name="event_type"
              rules={{ required: t('validation.required') }}
              render={({ field }) => (
                <VocabSelect
                  id="health-type"
                  className="w-full"
                  value={field.value || null}
                  onValueChange={(v) => field.onChange(v ?? '')}
                  codes={HEALTH_EVENT_CODES}
                  prefix="vocab.healthEvent"
                  placeholder={t('common.select')}
                />
              )}
            />
            {errors.event_type && (
              <p className="text-sm text-destructive">
                {errors.event_type.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="health-date">{t('records.date')}</Label>
            <Input
              id="health-date"
              type="date"
              {...register('occurred_on', { required: t('validation.required') })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="health-product">{t('records.product')}</Label>
            <Input id="health-product" {...register('product')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="health-withdrawal">
              {t('records.withdrawalUntil')}
            </Label>
            <Input
              id="health-withdrawal"
              type="date"
              {...register('withdrawal_until')}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="health-description">
              {t('records.description')}
            </Label>
            <Textarea
              id="health-description"
              rows={2}
              {...register('description')}
            />
          </div>
          <Button
            type="submit"
            disabled={add.isPending}
            className="sm:col-span-2 sm:justify-self-end"
          >
            {t('records.addHealth')}
          </Button>
        </form>

        {list.isPending && <Skeleton className="h-24 w-full" />}
        {list.data?.data.length === 0 && (
          <p className="py-4 text-center text-muted-foreground">
            {t('records.noHealth')}
          </p>
        )}
        {list.data?.data.map((event) => (
          <RecordRow
            key={event.id}
            deleteLabel={t('common.delete')}
            onDelete={() =>
              remove.mutate(event.id, {
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            <p className="font-medium">
              {t(`vocab.healthEvent.${event.event_type}`)}
              {event.product && (
                <span className="text-muted-foreground"> · {event.product}</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDate(event.occurred_on)}
            </p>
            {event.description && (
              <p className="mt-1 text-sm">{event.description}</p>
            )}
            {event.withdrawal_until && (
              <p
                className={
                  withdrawalActive(event.withdrawal_until)
                    ? 'mt-1 text-sm font-medium text-status-warning'
                    : 'mt-1 text-sm text-muted-foreground'
                }
              >
                {t('records.withdrawalNotice', {
                  date: formatDate(event.withdrawal_until),
                })}
              </p>
            )}
          </RecordRow>
        ))}
      </CardContent>
    </Card>
  );
}

export function NotesTab({ animalId }: { animalId: string }) {
  const { t } = useTranslation();
  const list = notesApi.useList(animalId);
  const add = notesApi.useAdd(animalId);
  const remove = notesApi.useRemove(animalId);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<{ body: string }>({ defaultValues: { body: '' } });

  const onSubmit = handleSubmit((values) => {
    add.mutate(
      { body: values.body },
      {
        onSuccess: () => {
          toast.success(t('records.noteAdded'));
          reset();
        },
        onError: (error) => {
          if (!applyFieldErrors(error, setError))
            toast.error(errorMessage(error));
        },
      },
    );
  });

  return (
    <Card>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="mb-4 space-y-2" noValidate>
          <Label htmlFor="note-body">{t('records.newNote')}</Label>
          <Textarea
            id="note-body"
            rows={3}
            {...register('body', { required: t('validation.required') })}
          />
          {errors.body && (
            <p className="text-sm text-destructive">{errors.body.message}</p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={add.isPending}>
              {t('records.addNote')}
            </Button>
          </div>
        </form>

        {list.isPending && <Skeleton className="h-24 w-full" />}
        {list.data?.data.length === 0 && (
          <p className="py-4 text-center text-muted-foreground">
            {t('records.noNotes')}
          </p>
        )}
        {list.data?.data.map((note) => (
          <RecordRow
            key={note.id}
            deleteLabel={t('common.delete')}
            onDelete={() =>
              remove.mutate(note.id, {
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            <p className="whitespace-pre-wrap text-sm">{note.body}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(note.created_at)}
            </p>
          </RecordRow>
        ))}
      </CardContent>
    </Card>
  );
}
