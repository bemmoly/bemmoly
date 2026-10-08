import type { Invitation, User, UserStatus } from '@bemmoly/shared';

/** Neither accepted nor revoked; expired ones stay so the admin can resend or copy a link. */
export function isPending(invitation: Invitation): boolean {
  return !invitation.acceptedAt && !invitation.revokedAt;
}

/**
 * An invited person has an invitation and no account until they accept, so /users never
 * lists them. Each pending invitation becomes a row shaped like a user with status
 * `invited`; its id is the invitation's, and the address stands in for the name they have
 * not chosen yet. Addresses that already have an account (an imported person) are skipped.
 */
export function invitationRows(
  invitations: readonly Invitation[],
  accounts: readonly Pick<User, 'email'>[],
): User[] {
  const known = new Set(accounts.map((user) => user.email.toLowerCase()));
  return invitations
    .filter((invitation) => isPending(invitation) && !known.has(invitation.email.toLowerCase()))
    .map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      name: invitation.email,
      avatarKey: null,
      status: 'invited',
      isBreakGlass: false,
      roleId: invitation.roleId,
      teamIds: invitation.teamId ? [invitation.teamId] : [],
      themePref: null,
      locale: null,
      timezone: null,
      lastSeenAt: null,
      createdAt: invitation.createdAt,
    }));
}

/** The server's text and status filters, applied to invitation rows the server did not list. */
export function matchesServerFilters(
  row: User,
  filters: { q: string; status: UserStatus | '' },
): boolean {
  const q = filters.q.toLowerCase();
  return (
    (!filters.status || row.status === filters.status) &&
    (!q || row.email.toLowerCase().includes(q) || row.name.toLowerCase().includes(q))
  );
}
