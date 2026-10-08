import { isApiError, queryKeys } from '@bemmoly/api-client';
import type { CreateInvitationsResponse, Invitation, Role, User } from '@bemmoly/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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

/** The invitation behind an INVITED row, read fresh so a just-resent one is found. */
async function pendingFor(queryClient: ReturnType<typeof useQueryClient>, email: string) {
  const { items } = await queryClient.fetchQuery({ ...invitationsQuery, staleTime: 0 });
  const invitation = pendingInvitation(items, email);
  if (!invitation) throw new Error(`No pending invitation for ${email}`);
  return invitation;
}

/** A link shown for copying after the action that issued it. */
export interface ShownLink {
  email: string;
  acceptUrl: string;
}

/**
 * Role changes and the ··· menu: deactivate, reactivate, and for an invitation resend, copy
 * its link or revoke. Anything that issues a new link while email is not set up shows it,
 * since the old link stops working and nobody receives the email.
 */
export function useUserActions(roles: readonly Role[]) {
  const queryClient = useQueryClient();
  const [shownLink, setShownLink] = useState<ShownLink | null>(null);
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

  const reissued = (response: CreateInvitationsResponse, message: string) => {
    const [item] = response.items;
    if (!response.emailConfigured && item) {
      setShownLink({ email: item.email, acceptUrl: item.acceptUrl });
    }
    return done(message)();
  };

  /** Sends a fresh invitation with the same role (or a new one) and first team. */
  const resend = useMutation({
    mutationFn: ({ user, roleId }: { user: User; roleId?: string }) =>
      api.invitations.create({
        emails: [user.email],
        roleId: roleId ?? user.roleId,
        ...(user.teamIds[0] ? { teamId: user.teamIds[0] } : {}),
      }),
    onSuccess: (response, { user, roleId }) => {
      const role = roles.find((entry) => entry.id === roleId)?.name;
      return reissued(
        response,
        role ? `${user.email} will join as ${role}` : `Invitation sent again to ${user.email}`,
      );
    },
    onError,
  });

  /** A new link for the invitation, shown to copy; the previous link stops working. */
  const copyLink = useMutation({
    mutationFn: async (user: User) =>
      api.invitations.issueLink((await pendingFor(queryClient, user.email)).id),
    onSuccess: async (issued) => {
      setShownLink({ email: issued.email, acceptUrl: issued.acceptUrl });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations() });
    },
    onError: (error) =>
      toast(isApiError(error) ? describeError(error).message : error.message, 'danger'),
  });

  const revoke = useMutation({
    mutationFn: async (user: User) => {
      await api.invitations.revoke((await pendingFor(queryClient, user.email)).id);
    },
    onSuccess: (_, user) => done(`Invitation to ${user.email} revoked`)(),
    onError: (error) =>
      toast(isApiError(error) ? describeError(error).message : error.message, 'danger'),
  });

  return {
    changeRole,
    deactivate,
    reactivate,
    resend,
    copyLink,
    revoke,
    shownLink,
    closeLink: () => setShownLink(null),
  };
}
