import { Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { VocabSelect } from '@/components/vocab-select';
import { useMe } from '@/features/auth/api';
import { usePermissions } from '@/features/auth/permissions';
import {
  useInviteMember,
  useMembers,
  useRemoveMember,
  useUpdateMember,
} from '@/features/members/api';
import { ApiError } from '@/lib/api/client';
import { MEMBER_ROLES, type Member, type MemberRole } from '@/lib/api/types';
import { applyFieldErrors, errorMessage } from '@/lib/form';
import { fullName } from '@/lib/format';

interface InviteForm {
  first_name: string;
  last_name: string;
  email: string;
  role: MemberRole;
}

function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const invite = useInviteMember();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    watch,
    formState: { errors },
  } = useForm<InviteForm>({
    defaultValues: { first_name: '', last_name: '', email: '', role: 'viewer' },
  });

  const onSubmit = handleSubmit((values) =>
    invite.mutate(values, {
      onSuccess: (member) => {
        toast.success(t('members.invited', { email: member.email }));
        reset();
        onOpenChange(false);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          setError('email', { message: t('members.emailTaken') });
        } else if (!applyFieldErrors(error, setError)) {
          toast.error(errorMessage(error));
        }
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('members.inviteTitle')}</DialogTitle>
          <DialogDescription>{t('members.inviteHelp')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="member-first-name">{t('members.firstName')}</Label>
            <Input
              id="member-first-name"
              {...register('first_name', { required: t('validation.required') })}
            />
            {errors.first_name && (
              <p className="text-sm text-destructive">
                {errors.first_name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-last-name">{t('members.lastName')}</Label>
            <Input
              id="member-last-name"
              {...register('last_name', { required: t('validation.required') })}
            />
            {errors.last_name && (
              <p className="text-sm text-destructive">
                {errors.last_name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-email">{t('members.email')}</Label>
            <Input
              id="member-email"
              type="email"
              autoComplete="off"
              {...register('email', { required: t('validation.required') })}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-role">{t('members.permissions')}</Label>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <VocabSelect
                  id="member-role"
                  value={field.value}
                  onValueChange={field.onChange}
                  codes={MEMBER_ROLES}
                  prefix="members.role"
                />
              )}
            />
            <p className="text-sm text-muted-foreground">
              {t(`members.roleHelp.${watch('role')}`)}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {t('members.send')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MembersPage() {
  const { t } = useTranslation();
  const me = useMe();
  const members = useMembers();
  const remove = useRemoveMember();
  const update = useUpdateMember();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const { isOwner } = usePermissions();

  const changeRole = (member: Member, role: MemberRole) =>
    update.mutate(
      { id: member.id, role },
      {
        onSuccess: () =>
          toast.success(t('members.roleUpdated', { name: fullName(member) })),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  return (
    <>
      <PageHeader title={t('nav.members')} count={members.data?.data.length}>
        {isOwner && (
          <Button onClick={() => setInviting(true)}>
            <UserPlus className="size-4" /> {t('members.invite')}
          </Button>
        )}
      </PageHeader>

      {!isOwner && me.data && (
        <p className="mb-4 text-sm text-muted-foreground">
          {t('members.ownerOnly')}
        </p>
      )}

      {members.isPending && <Skeleton className="h-40 w-full" />}
      {members.isError && (
        <p className="text-destructive">{errorMessage(members.error)}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {members.data?.data.map((member) => (
          <Card key={member.id}>
            <CardContent className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">
                  {fullName(member)}
                  {member.id === me.data?.id && (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      ({t('members.you')})
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {member.email}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  {isOwner && member.role !== 'owner' ? (
                    <VocabSelect
                      className="h-8 w-40"
                      value={member.role}
                      onValueChange={(role) =>
                        role && changeRole(member, role as MemberRole)
                      }
                      codes={MEMBER_ROLES}
                      prefix="members.role"
                    />
                  ) : (
                    <Badge variant="secondary">
                      {t(`members.role.${member.role}`)}
                    </Badge>
                  )}
                  {member.status === 'invited' && (
                    <Badge variant="outline">
                      {t('members.status.invited')}
                    </Badge>
                  )}
                </div>
              </div>
              {isOwner && member.role !== 'owner' && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('members.remove')}
                  onClick={() => setRemoving(member)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <InviteDialog open={inviting} onOpenChange={setInviting} />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('members.removeTitle')}
        description={t('members.removeDescription', {
          name: removing && fullName(removing),
        })}
        confirmLabel={t('members.remove')}
        pending={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => {
              toast.success(t('members.removed'));
              setRemoving(null);
            },
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
      />
    </>
  );
}
