import { queryKeys } from '@bemmoly/api-client';
import {
  createInvitationsSchema,
  type CreateInvitationsInput,
  type CreateInvitationsResponse,
} from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api.ts';
import { describeError, serverFieldErrors, validateForm, type FieldErrors } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { rolesQuery, roleOptions, teamsQuery } from './use-people.ts';
import { defaultRoleId, invitationsSentMessage, parseEmails } from './use-setup-invites.ts';

interface InviteForm {
  text: string;
  roleId: string;
  teamId: string;
}

const EMPTY: InviteForm = { text: '', roleId: '', teamId: '' };

/**
 * The Invite people dialog: pasted addresses, a role (Viewer by default) and an optional team.
 * After sending, `sent` holds each invitee's link so the dialog can show them for sharing.
 */
export function useInviteForm(onSent?: (response: CreateInvitationsResponse) => void) {
  const queryClient = useQueryClient();
  const roles = useQuery(rolesQuery).data?.items ?? [];
  const teams = useQuery(teamsQuery).data?.items ?? [];
  const [form, setForm] = useState<InviteForm>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sent, setSent] = useState<CreateInvitationsResponse | null>(null);
  const roleId = form.roleId || defaultRoleId(roles) || '';

  const mutation = useMutation({
    mutationFn: (body: CreateInvitationsInput) => api.invitations.create(body),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.users.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.invitations() }),
      ]);
      toast(invitationsSentMessage(response.items.length));
      setForm(EMPTY);
      setSent(response);
      onSent?.(response);
    },
    onError: (error) => {
      const fields = serverFieldErrors(error);
      setErrors({ emails: fields['emails'] ?? describeError(error).message });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const { valid, invalid } = parseEmails(form.text);
    if (invalid.length) return setErrors({ emails: `Not an email address: ${invalid.join(', ')}` });
    if (!valid.length) return setErrors({ emails: 'Add at least one email address' });
    const result = validateForm(createInvitationsSchema, {
      emails: valid,
      ...(roleId ? { roleId } : {}),
      ...(form.teamId ? { teamId: form.teamId } : {}),
    });
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    mutation.mutate(result.data);
  };

  return {
    form: { ...form, roleId },
    update: (patch: Partial<InviteForm>) => setForm((current) => ({ ...current, ...patch })),
    count: parseEmails(form.text).valid.length,
    errors,
    submit,
    mutation,
    sent,
    reset: () => {
      setForm(EMPTY);
      setErrors({});
      setSent(null);
    },
    roleOptions: roleOptions(roles),
    teamOptions: [
      { value: '', label: 'No team' },
      ...teams.map((team) => ({ value: team.id, label: team.name })),
    ],
  };
}
