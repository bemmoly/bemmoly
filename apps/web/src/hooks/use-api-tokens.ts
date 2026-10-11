import { queryKeys } from '@bemmoly/api-client';
import type { ApiToken, CreateApiTokenInput, CreatedApiToken } from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { toast } from '../lib/toast.ts';
import { useModules } from './use-modules.ts';

export type TokenAccess = 'read' | 'write';
export type TokenExpiry = 'never' | '30' | '90';

export interface TokenForm {
  name: string;
  access: TokenAccess;
  allModules: boolean;
  modules: string[];
  expiry: TokenExpiry;
}

const EMPTY: TokenForm = { name: '', access: 'read', allModules: true, modules: [], expiry: '90' };

const DAY_MS = 86_400_000;

/** What the form sends: a write token can also read; "never" stores no expiry. */
export function toCreateInput(form: TokenForm, now = Date.now()): CreateApiTokenInput {
  return {
    name: form.name.trim(),
    scopes: form.access === 'write' ? ['read', 'write'] : ['read'],
    expiresAt:
      form.expiry === 'never' ? null : new Date(now + Number(form.expiry) * DAY_MS).toISOString(),
    modules: form.allModules ? null : form.modules,
  };
}

export const accessLabel = (token: ApiToken) =>
  token.scopes.includes('write') ? 'Read and write' : 'Read only';

/** Module names for a token's row: "All modules", or the names of the ones it may reach. */
export function useModuleNames() {
  const { data = [] } = useModules();
  const options = data.map((module) => ({ id: module.id, name: module.name ?? module.id }));
  const label = (modules: readonly string[] | null) =>
    modules === null
      ? 'All modules'
      : modules.map((id) => options.find((option) => option.id === id)?.name ?? id).join(', ');
  return { options, label };
}

/** Profile › Access tokens: the signed-in person's tokens, and revoking one. */
export function useApiTokens() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.apiTokens(), queryFn: () => api.apiTokens.list() });
  const [revoking, setRevoking] = useState<ApiToken | null>(null);
  const revoke = useMutation({
    mutationFn: (token: ApiToken) => api.apiTokens.revoke(token.id),
    onSuccess: async (_, token) => {
      setRevoking(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.apiTokens() });
      toast(`${token.name} revoked`);
    },
  });
  const ask = (token: ApiToken | null) => {
    revoke.reset();
    setRevoking(token);
  };
  return { query, tokens: query.data?.items ?? [], revoking, ask, revoke };
}

/** The create dialog: the form, its validation, and the secret, kept only while it is open. */
export function useCreateApiToken(onClose: () => void) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TokenForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'modules', string>>>({});
  const [created, setCreated] = useState<CreatedApiToken | null>(null);
  const mutation = useMutation({
    mutationFn: (input: CreateApiTokenInput) => api.apiTokens.create(input),
    onSuccess: async (result) => {
      setCreated(result);
      await queryClient.invalidateQueries({ queryKey: queryKeys.apiTokens() });
    },
  });
  const update = (patch: Partial<TokenForm>) => setForm((current) => ({ ...current, ...patch }));
  const toggleModule = (id: string) =>
    update({
      modules: form.modules.includes(id)
        ? form.modules.filter((entry) => entry !== id)
        : [...form.modules, id],
    });
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Give the token a name, such as the client that uses it.';
    if (!form.allModules && form.modules.length === 0) next.modules = 'Choose at least one module.';
    setErrors(next);
    if (Object.keys(next).length === 0) mutation.mutate(toCreateInput(form));
  };
  const close = () => {
    setForm(EMPTY);
    setErrors({});
    setCreated(null);
    mutation.reset();
    onClose();
  };
  return { form, errors, update, toggleModule, submit, close, created, mutation };
}
