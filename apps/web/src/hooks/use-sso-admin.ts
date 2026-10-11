import { queryKeys } from '@bemmoly/api-client';
import type {
  CreateSsoProviderInput,
  SsoPolicy,
  SsoProvider,
  UpdateSsoProviderInput,
} from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';

/** A test sign-in leaves the page for the identity provider; tests swap this out. */
export const navigation = { assign: (url: string) => window.location.assign(url) };

/** A provider's state in words, for its card: off, not tested, signs in, or why it failed. */
export function providerState(provider: SsoProvider): {
  tone: 'ok' | 'red' | 'neutral' | 'warn';
  label: string;
} {
  if (!provider.enabled) return { tone: 'neutral', label: 'Off' };
  if (!provider.lastTest) return { tone: 'warn', label: 'Not tested yet' };
  return provider.lastTest.ok
    ? { tone: 'ok', label: 'Signs in' }
    : { tone: 'red', label: 'Test failed' };
}

/** Identity providers: the list, create, edit, delete and the test round trip. */
export function useSsoProviders(enabled = true) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.sso.providers(),
    queryFn: () => api.sso.providers(),
    enabled,
  });
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.sso.all() });
  const create = useMutation({
    mutationFn: (input: CreateSsoProviderInput) => api.sso.createProvider(input),
    onSuccess: async (row) => {
      toast(`${row.displayName} added`);
      await refresh();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSsoProviderInput }) =>
      api.sso.updateProvider(id, input),
    onSuccess: async (row) => {
      toast(`${row.displayName} saved`);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.sso.deleteProvider(id),
    onSuccess: async () => {
      toast('Identity provider deleted');
      await refresh();
    },
  });
  const test = useMutation({
    mutationFn: (id: string) => api.sso.startTest(id),
    onSuccess: ({ authorizationUrl }) => navigation.assign(authorizationUrl),
    onError: (error) => toast(describeError(error).message, 'danger'),
  });
  return {
    query,
    items: query.data?.items ?? [],
    create: (input: CreateSsoProviderInput) => create.mutateAsync(input),
    creating: create.isPending,
    update: (id: string, input: UpdateSsoProviderInput) => update.mutateAsync({ id, input }),
    updating: update.isPending,
    remove: (id: string) => remove.mutateAsync(id),
    removing: remove.isPending,
    test: (id: string) => test.mutate(id),
    testing: test.isPending ? (test.variables ?? null) : null,
  };
}

export type SsoProviders = ReturnType<typeof useSsoProviders>;

/** "Require SSO for everyone" and the break-glass admins it keeps. */
export function useSsoPolicy(enabled = true) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.sso.policy(),
    queryFn: () => api.sso.policy(),
    enabled,
  });
  const update = useMutation({
    mutationFn: (requireSso: boolean) => api.sso.updatePolicy({ requireSso }),
    onSuccess: async (policy: SsoPolicy) => {
      client.setQueryData(queryKeys.sso.policy(), policy);
      toast(policy.requireSso ? 'Single sign-on is now required' : 'Password sign-in is back on');
      await client.invalidateQueries({ queryKey: queryKeys.sso.signInOptions() });
    },
  });
  return {
    query,
    policy: query.data ?? null,
    set: (requireSso: boolean) => update.mutateAsync(requireSso),
    saving: update.isPending,
  };
}

export type SsoPolicyState = ReturnType<typeof useSsoPolicy>;

/** SCIM bearer tokens: listed by prefix, the secret shown once on create. */
export function useScimTokens(enabled = true) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.sso.scimTokens(),
    queryFn: () => api.sso.scimTokens(),
    enabled,
  });
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.sso.scimTokens() });
  const create = useMutation({
    mutationFn: (name: string) => api.sso.createScimToken({ name }),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.sso.revokeScimToken(id),
    onSuccess: async () => {
      toast('SCIM token revoked');
      await refresh();
    },
  });
  return {
    query,
    items: query.data?.items ?? [],
    baseUrl: query.data?.baseUrl ?? '',
    create: (name: string) => create.mutateAsync(name),
    creating: create.isPending,
    revoke: (id: string) => revoke.mutateAsync(id),
    revoking: revoke.isPending,
  };
}

export type ScimTokens = ReturnType<typeof useScimTokens>;
