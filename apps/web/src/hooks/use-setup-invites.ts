import { queryKeys } from '@bemmoly/api-client';
import { createInvitationsSchema, emailSchema, type Role } from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { describeError, serverFieldErrors, validateForm } from '../lib/errors.ts';
import { useSetupStore } from '../store/setup.ts';
import { toast } from '../lib/toast.ts';

export const SSO_NOTE =
  'Single sign-on arrives in a later release. Invite by email now; people can switch later.';
export const EMAIL_NOTE =
  'Invitations are sent through the email settings; in development they appear in the dev mailbox.';
export const INVITE_HELPER =
  'Everyone you add here joins as a Member with no team, unless you pick otherwise below.';
export const PASTE_PLACEHOLDER = 'Paste more, comma or newline separated…';

/**
 * The two SSO cards from the mock, marked coming soon until single sign-on ships. The mock's
 * RECOMMENDED badge and connect buttons return with it; recommending an option that cannot be
 * picked yet would only compete with the coming-soon badge.
 */
export const SSO_OPTIONS = [
  {
    id: 'google',
    initials: 'G',
    name: 'Google Workspace',
    description: 'Anyone with an account on your domain can sign in. New users become Members.',
  },
  {
    id: 'oidc',
    initials: 'ID',
    name: 'Okta, Entra, SAML, OIDC',
    description:
      'Any standards-based identity provider, with SCIM provisioning and group → team mapping.',
  },
] as const;

export type SsoOptionId = (typeof SSO_OPTIONS)[number]['id'];

const SEPARATOR = /[\s,;]+/;

/** Splits pasted text into addresses: trimmed, lower-cased, de-duplicated, valid ones first. */
export function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const part of text.split(SEPARATOR)) {
    const candidate = part.trim().toLowerCase();
    if (!candidate) continue;
    const bucket = emailSchema.safeParse(candidate).success ? valid : invalid;
    if (!bucket.includes(candidate)) bucket.push(candidate);
  }
  return { valid, invalid };
}

/** Member is the default the mock shows; any non-admin role will do if it was renamed. */
export function defaultRoleId(roles: readonly Role[]): string | null {
  const member = roles.find((role) => role.key === 'member');
  return (member ?? roles.find((role) => role.key !== 'org_admin') ?? roles[0])?.id ?? null;
}

export function invitationsSentMessage(count: number): string {
  return count === 1 ? '1 invitation sent' : `${count} invitations sent`;
}

/** Step 3: email chips, role and team, and sending the invitations on Continue. */
export function useSetupInvites(onDone: () => void | Promise<void>) {
  const queryClient = useQueryClient();
  const emails = useSetupStore((state) => state.emails);
  const storedRoleId = useSetupStore((state) => state.roleId);
  const teamId = useSetupStore((state) => state.teamId);
  const invitesSent = useSetupStore((state) => state.invitesSent);
  const update = useSetupStore((state) => state.update);
  const addEmails = useSetupStore((state) => state.addEmails);
  const removeEmail = useSetupStore((state) => state.removeEmail);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const roles = useQuery({ queryKey: queryKeys.roles(), queryFn: () => api.roles.list() });
  const teams = useQuery({ queryKey: queryKeys.teams.all(), queryFn: () => api.teams.list() });
  const roleItems = roles.data?.items ?? [];
  const roleId = storedRoleId ?? defaultRoleId(roleItems);

  /** Moves every valid address into a chip; anything else stays in the box with a message. */
  const commit = (value: string) => {
    const parsed = parseEmails(value);
    addEmails(parsed.valid);
    setText(parsed.invalid.join(', '));
    setError(
      parsed.invalid.length ? `Not an email address: ${parsed.invalid.join(', ')}` : undefined,
    );
    return parsed;
  };

  const mutation = useMutation({
    mutationFn: (body: { emails: string[]; roleId: string; teamId?: string }) =>
      api.invitations.create(body),
    onSuccess: async (response) => {
      const count = response.items.length;
      toast(invitationsSentMessage(count));
      update({ invitesSent: invitesSent + count, emails: [] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations() });
      await onDone();
    },
    onError: (failure) => {
      const fields = serverFieldErrors(failure);
      setError(fields['emails'] ?? describeError(failure).message);
    },
  });

  /** Continue: sends what is in the chips and the box; with nothing to send, just moves on. */
  const submit = () => {
    const pending = commit(text);
    if (pending.invalid.length) return;
    const all = [...new Set([...emails, ...pending.valid])];
    if (!all.length) return void onDone();
    const result = validateForm(createInvitationsSchema, {
      emails: all,
      roleId,
      ...(teamId ? { teamId } : {}),
    });
    if (result.errors) {
      const first = Object.entries(result.errors).find(([, message]) => message);
      return setError(first?.[1] ?? 'Check the addresses and the role');
    }
    setError(undefined);
    mutation.mutate(result.data);
  };

  return {
    emails,
    text,
    /** Typing a separator (space, comma, newline) turns what came before it into chips. */
    change: (value: string) => (SEPARATOR.test(value) ? void commit(value) : setText(value)),
    paste: (value: string) => void commit(`${text} ${value}`),
    remove: removeEmail,
    error,
    roleId,
    setRoleId: (id: string) => update({ roleId: id }),
    roleOptions: roleItems.map((role) => ({ value: role.id, label: role.name })),
    teamId,
    setTeamId: (id: string) => update({ teamId: id || null }),
    teamOptions: [
      { value: '', label: 'No team' },
      ...(teams.data?.items ?? []).map((team) => ({ value: team.id, label: team.name })),
    ],
    loading: roles.isPending,
    submit,
    mutation,
  };
}
