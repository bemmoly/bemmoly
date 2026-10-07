import { queryKeys } from '@bemmoly/api-client';
import { createFirstAdminSchema, type CreateFirstAdminInput } from '@bemmoly/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api.ts';
import { serverFieldErrors, validateForm, type FieldErrors } from '../lib/errors.ts';

export type AdminForm = CreateFirstAdminInput;

export const PASSWORD_HINT =
  'At least 12 characters. You can switch to SSO later and keep this as the break-glass login.';

/** The URL field starts at the address the browser used to reach this server. */
export function initialAdminForm(origin: string = window.location.origin): AdminForm {
  return { workspaceName: '', workspaceUrl: origin, name: '', email: '', password: '' };
}

/**
 * Step 1's form. Creating the admin also signs them in, so on success the
 * setup status and the session are refreshed before the wizard moves on.
 */
export function useSetupAdmin(onCreated: () => void | Promise<void>) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<AdminForm>(() => initialAdminForm());
  const [errors, setErrors] = useState<FieldErrors>({});
  const set =
    <F extends keyof AdminForm>(field: F) =>
    (value: AdminForm[F]) => {
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  const mutation = useMutation({
    mutationFn: (body: AdminForm) => api.setup.createAdmin(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.setupStatus() });
      await queryClient.fetchQuery({ queryKey: queryKeys.me(), queryFn: () => api.auth.me() });
      await onCreated();
    },
    onError: (error) => setErrors(serverFieldErrors(error)),
  });
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const result = validateForm(createFirstAdminSchema, {
      ...values,
      workspaceUrl: values.workspaceUrl.trim().replace(/\/+$/, ''),
    });
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    mutation.mutate(result.data);
  };
  return { values, errors, set, submit, mutation };
}
