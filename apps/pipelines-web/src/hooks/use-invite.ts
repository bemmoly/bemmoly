import { WORKSPACE_ROLE_FOR, type InvitePeopleBody } from '@bemmoly/module-pipelines/shared';
import type { IssuedInvitation } from '@bemmoly/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rolesKeys } from '../api/roles.ts';
import { api } from '../lib/api.ts';

export interface InviteOutcome {
  count: number;
  /** Accept links to share by hand while the install sends no email. */
  links: IssuedInvitation[];
}

/** "a@x.test, b@x.test\nc@x.test" as addresses, each once. */
export function parseEmails(text: string): string[] {
  const parts = text
    .split(/[\s,;]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(parts)];
}

export const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * Inviting gives Pipelines roles first (pending for addresses without an account), then asks
 * the workspace to invite those addresses with the account the role needs to do its work.
 */
export function useInvitePeople() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: InvitePeopleBody): Promise<InviteOutcome> => {
      const result = await api.roles.invite(body);
      if (result.needAccount.length === 0) return { count: result.items.length, links: [] };
      const roles = await api.roles.workspaceRoles();
      const role = roles.items.find((item) => item.key === WORKSPACE_ROLE_FOR[body.role]);
      const sent = await api.invitations.create({
        emails: result.needAccount,
        ...(role ? { roleId: role.id } : {}),
      });
      return { count: result.items.length, links: sent.emailConfigured ? [] : sent.items };
    },
    onSettled: () => client.invalidateQueries({ queryKey: rolesKeys.all }),
  });
}
