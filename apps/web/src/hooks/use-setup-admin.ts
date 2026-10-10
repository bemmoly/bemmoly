import { queryKeys } from '@bemmoly/api-client';
import { createFirstAdminSchema, type CreateFirstAdminInput } from '@bemmoly/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api.ts';
import { serverFieldErrors, validateForm, type FieldErrors } from '../lib/errors.ts';
import { useSetupStore } from '../store/setup.ts';

export type AdminForm = CreateFirstAdminInput;
export type WorkspaceForm = Pick<AdminForm, 'workspaceName' | 'workspaceUrl'>;
export type AccountForm = Pick<AdminForm, 'name' | 'email' | 'password'>;

export const PASSWORD_HINT = 'At least 12 characters. A short sentence is easy to remember.';

export const URL_HINT =
  'Filled in from the address this browser used. Change it if people reach Bemmoly another way.';

const WORKSPACE_FIELDS = ['workspaceName', 'workspaceUrl'] as const;
const workspaceSchema = createFirstAdminSchema.pick({ workspaceName: true, workspaceUrl: true });
const accountSchema = createFirstAdminSchema.pick({ name: true, email: true, password: true });

/** A URL as stored: trimmed, without a trailing slash. */
export function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** The URL field starts at the address the browser used to reach this server. */
export function initialWorkspaceUrl(origin: string = window.location.origin): string {
  return origin;
}

/** One field's message, checked on blur, so a mistake shows when the field is left. */
function fieldMessage<S extends typeof workspaceSchema | typeof accountSchema>(
  schema: S,
  values: Record<string, string>,
  field: string,
): string | undefined {
  const result = validateForm(schema, values);
  return result.errors?.[field];
}

/**
 * The first step: the workspace's name and address. Nothing is saved yet; the account step
 * creates the admin and the workspace together, so these wait in the wizard's draft.
 */
export function useSetupWorkspace(onDone: () => void | Promise<void>) {
  const name = useSetupStore((state) => state.workspaceName);
  const storedUrl = useSetupStore((state) => state.workspaceUrl);
  const update = useSetupStore((state) => state.update);
  const values: WorkspaceForm = {
    workspaceName: name,
    workspaceUrl: storedUrl ?? initialWorkspaceUrl(),
  };
  const [errors, setErrors] = useState<FieldErrors>({});
  const check = { ...values, workspaceUrl: cleanUrl(values.workspaceUrl) };
  return {
    values,
    errors,
    set: (field: keyof WorkspaceForm) => (value: string) => {
      update(field === 'workspaceName' ? { workspaceName: value } : { workspaceUrl: value });
      setErrors((current) => ({ ...current, [field]: undefined }));
    },
    blur: (field: keyof WorkspaceForm) => () => {
      if (field === 'workspaceName' && !values.workspaceName) return;
      setErrors((current) => ({
        ...current,
        [field]: fieldMessage(workspaceSchema, check, field),
      }));
    },
    submit: (event?: FormEvent) => {
      event?.preventDefault();
      const result = validateForm(workspaceSchema, check);
      if (result.errors) return setErrors(result.errors);
      setErrors({});
      update({ workspaceName: result.data.workspaceName, workspaceUrl: result.data.workspaceUrl });
      void onDone();
    },
  };
}

/**
 * The account step. Creating the admin also creates the workspace from the first step and
 * signs them in, so on success the setup status and the session are refreshed before the
 * wizard moves on. A workspace the server refuses sends them back to fix it.
 */
export function useSetupAdmin(onCreated: () => void | Promise<void>, onWorkspaceError: () => void) {
  const queryClient = useQueryClient();
  const workspaceName = useSetupStore((state) => state.workspaceName);
  const workspaceUrl = useSetupStore((state) => state.workspaceUrl) ?? initialWorkspaceUrl();
  const [values, setValues] = useState<AccountForm>({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = useMutation({
    mutationFn: (body: AdminForm) => api.setup.createAdmin(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.setupStatus() });
      await queryClient.fetchQuery({ queryKey: queryKeys.me(), queryFn: () => api.auth.me() });
      await onCreated();
    },
    onError: (error) => {
      const fields = serverFieldErrors(error);
      if (WORKSPACE_FIELDS.some((field) => fields[field])) onWorkspaceError();
      setErrors(fields);
    },
  });
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (mutation.isPending) return;
    const result = validateForm(createFirstAdminSchema, {
      ...values,
      workspaceName,
      workspaceUrl: cleanUrl(workspaceUrl),
    });
    if (result.errors) {
      if (WORKSPACE_FIELDS.some((field) => result.errors[field])) return onWorkspaceError();
      return setErrors(result.errors);
    }
    setErrors({});
    mutation.mutate(result.data);
  };
  return {
    values,
    errors,
    set: (field: keyof AccountForm) => (value: string) => {
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    },
    blur: (field: keyof AccountForm) => () => {
      if (!values[field]) return;
      setErrors((current) => ({ ...current, [field]: fieldMessage(accountSchema, values, field) }));
    },
    submit,
    mutation,
    /** Field messages say what to fix; anything else is shown with Retry. */
    failed: mutation.isError && !Object.values(errors).some(Boolean),
  };
}
