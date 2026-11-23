import { useMe } from '@/features/auth/api';

// What the signed-in user's role allows, mirroring the API's
// PermissionsGuard: viewer reads, editor also adds and edits, owner also
// deletes and manages people. Hiding controls is a courtesy; the API is the
// one that enforces it.
export function usePermissions() {
  const role = useMe().data?.role;
  return {
    canEdit: role === 'owner' || role === 'editor',
    canDelete: role === 'owner',
    isOwner: role === 'owner',
  };
}
