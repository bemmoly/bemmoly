import { isApiError, queryKeys } from '@bemmoly/api-client';
import type { Invitation, Role, User } from '@bemmoly/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { invitationsQuery } from './use-people.ts';

/** The newest invitation for this address that is neither accepted nor revoked. */
export function pendingInvitation(
  invitations: readonly Invitation[],
  email: string,
): Invitation | undefined {
  return invitations
    .filter((item) => item.email === email && !item.acceptedAt && !item.revokedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** Role changes and the ··· menu: deactivate, reactivate, resend or revoke an invitation. */
export function useUserActions(roles: readonly Role[]) {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roles() }),
    ]);
  const onError = (error: unknown) => toast(describeError(error).message, 'danger');
  const done = (message: string) => async () => {
    await refresh();
    toast(message);
  };

  const changeRole = useMutation({
    mutationFn: ({ user, roleId }: { user: User; roleId: string }) =>
      api.users.update(user.id, { roleId }),
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      const role = roles.find((entry) => entry.id === user.roleId);
      await done(`${user.name} is now ${role?.name ?? 'in a new role'}`)();
    },
    onError,
  });

  const deactivate = useMutation({
    mutationFn: (user: User) => api.users.deactivate(user.id),
    onSuccess: (user) => done(`${user.name} deactivated`)(),
    onError,
  });

  const reactivate = useMutation({
    mutationFn: (user: User) => api.users.reactivate(user.id),
    onSuccess: (user) => done(`${user.name} reactivated`)(),
    onError,
  });

  /** Sends a fresh invitation with the same role and first team. */
  const resend = useMutation({
    mutationFn: (user: User) =>
      api.invitations.create({
        emails: [user.email],
        roleId: user.roleId,
        ...(user.teamIds[0] ? { teamId: user.teamIds[0] } : {}),
      }),
    onSuccess: (_, user) => done(`Invitation sent again to ${user.email}`)(),
    onError,
  });

  const revoke = useMutation({
    mutationFn: async (user: User) => {
      const { items } = await queryClient.fetchQuery({ ...invitationsQuery, staleTime: 0 });
      const invitation = pendingInvitation(items, user.email);
      if (!invitation) throw new Error(`No pending invitation for ${user.email}`);
      await api.invitations.revoke(invitation.id);
    },
    onSuccess: (_, user) => done(`Invitation to ${user.email} revoked`)(),
    onError: (error) =>
      toast(isApiError(error) ? describeError(error).message : error.message, 'danger'),
  });

  return { changeRole, deactivate, reactivate, resend, revoke };
}
