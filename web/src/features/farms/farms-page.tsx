import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { PaginationControls } from '@/components/pagination-controls';
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
import {
  useCreateFarm,
  useDeleteFarm,
  useFarms,
  useUpdateFarm,
} from '@/features/farms/api';
import type { Farm } from '@/lib/api/types';
import { applyFieldErrors, errorMessage } from '@/lib/form';

interface FarmForm {
  name: string;
  location: string;
}

function FarmDialog({
  farm,
  open,
  onOpenChange,
}: {
  farm: Farm | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const create = useCreateFarm();
  const update = useUpdateFarm();
  const mutation = farm ? update : create;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FarmForm>({
    values: { name: farm?.name ?? '', location: farm?.location ?? '' },
  });

  const onSubmit = handleSubmit((values) => {
    const input = {
      name: values.name,
      location: values.location.trim() || undefined,
    };
    const options = {
      onSuccess: () => {
        toast.success(t(farm ? 'farms.updated' : 'farms.created'));
        onOpenChange(false);
      },
      onError: (error: Error) => {
        if (!applyFieldErrors(error, setError)) {
          toast.error(errorMessage(error));
        }
      },
    };
    if (farm) update.mutate({ id: farm.id, ...input }, options);
    else create.mutate(input, options);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(farm ? 'farms.editTitle' : 'farms.newTitle')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="farm-name">{t('farms.name')}</Label>
            <Input
              id="farm-name"
              {...register('name', { required: t('validation.required') })}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="farm-location">{t('farms.location')}</Label>
            <Input id="farm-location" {...register('location')} />
            {errors.location && (
              <p className="text-sm text-destructive">
                {errors.location.message}
              </p>
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
            <Button type="submit" disabled={mutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FarmsPage() {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const farms = useFarms({ offset });
  const remove = useDeleteFarm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Farm | null>(null);
  const [deleting, setDeleting] = useState<Farm | null>(null);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (farm: Farm) => {
    setEditing(farm);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader title={t('nav.farms')} count={farms.data?.total}>
        <Button onClick={openNew}>
          <Plus className="size-4" /> {t('farms.new')}
        </Button>
      </PageHeader>

      {farms.isPending && <Skeleton className="h-40 w-full" />}
      {farms.isError && (
        <p className="text-destructive">{errorMessage(farms.error)}</p>
      )}

      {farms.data && farms.data.data.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t('farms.empty')}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {farms.data?.data.map((farm) => (
          <Card key={farm.id}>
            <CardContent className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{farm.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {farm.location ?? t('farms.noLocation')}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.edit')}
                  onClick={() => openEdit(farm)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.delete')}
                  onClick={() => setDeleting(farm)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {farms.data && (
        <PaginationControls
          total={farms.data.total}
          limit={farms.data.limit}
          offset={farms.data.offset}
          onOffsetChange={setOffset}
        />
      )}

      <FarmDialog farm={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('farms.deleteTitle')}
        description={t('farms.deleteDescription', { name: deleting?.name })}
        confirmLabel={t('common.delete')}
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t('farms.deleted'));
              setDeleting(null);
            },
            // 409: the farm still has animals (see plan, Features).
            onError: (error) => toast.error(errorMessage(error)),
          });
        }}
      />
    </>
  );
}
