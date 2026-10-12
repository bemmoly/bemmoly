import { queryKeys } from '@bemmoly/api-client';
import type {
  AiCustomProtocol,
  AiProvider,
  AiProviderCreateBody,
  AiProviderTestResponse,
} from '@bemmoly/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError } from '../lib/errors.ts';
import { LOCAL_AI } from '../store/setup.ts';
import type { CatalogProvider } from './use-ai-catalog.ts';
import { aiAdminApi } from '../lib/ai-admin-api.ts';

/** One input the catalog entry asks for. */
export interface ConnectionField {
  name: string;
  /** Keys, secrets and tokens are masked; a region or resource name is plain text. */
  secret: boolean;
}

const SECRET = /KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL/i;

/** The form for a provider, generated only from its catalog entry's env list. */
export function connectionFields(provider: CatalogProvider): ConnectionField[] {
  return provider.env.map((name) => ({ name, secret: SECRET.test(name) }));
}

/** Named by the endpoint each protocol serves, so no vendor is named in the product. */
export const PROTOCOLS: readonly { value: AiCustomProtocol; label: string; description: string }[] =
  [
    {
      value: 'openai-compatible',
      label: 'Chat completions',
      description: 'Serves /v1/chat/completions and /v1/models, as most model servers do',
    },
    {
      value: 'anthropic-compatible',
      label: 'Messages',
      description: 'Serves /v1/messages',
    },
  ];

export interface ConnectionDraft {
  values: Record<string, string>;
  baseUrl: string;
  protocol: AiCustomProtocol;
  name: string;
  apiKey: string;
}

export function initialDraft(provider: CatalogProvider): ConnectionDraft {
  return {
    values: {},
    baseUrl: provider.api ?? '',
    protocol: 'openai-compatible',
    name: provider.id === LOCAL_AI ? 'Local server' : provider.name,
    apiKey: '',
  };
}

/** The create body for the draft; blank values are left out, so the server says what is missing. */
export function createBody(
  provider: CatalogProvider,
  draft: ConnectionDraft,
): AiProviderCreateBody {
  const baseUrl = draft.baseUrl.trim();
  if (provider.id === LOCAL_AI) {
    return {
      kind: 'custom',
      protocol: draft.protocol,
      name: draft.name.trim() || 'Local server',
      baseUrl,
      headers: {},
      ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
    };
  }
  const credentials = Object.fromEntries(
    Object.entries(draft.values)
      .map(([name, value]) => [name, value.trim()] as const)
      .filter(([, value]) => value !== ''),
  );
  return {
    kind: 'catalog',
    catalogId: provider.id,
    credentials,
    headers: {},
    ...(baseUrl && baseUrl !== provider.api ? { baseUrl } : {}),
  };
}

/** What a test result says, in the one place the copy is decided. */
export function testLine(result: AiProviderTestResponse): string {
  if (!result.ok) return result.message;
  const found = result.modelsFound === null ? '' : ` · ${result.modelsFound} models found`;
  return `${result.message}${found}`;
}

/** Why the form cannot be sent yet, under the field it is about. */
export function draftErrors(provider: CatalogProvider, draft: ConnectionDraft) {
  const errors: Partial<Record<'baseUrl', string>> = {};
  if (provider.id !== LOCAL_AI) return errors;
  const url = draft.baseUrl.trim();
  if (!url)
    errors.baseUrl = 'Enter the address of your model server, such as http://10.0.0.5:8000/v1';
  else if (!/^https?:\/\/[^\s/]+/.test(url))
    errors.baseUrl = 'Start the address with http:// or https://';
  return errors;
}

/**
 * The connection form for one provider: its values, a test of the values as typed (nothing is
 * stored), and connecting, which stores them and, for a Local server, discovers its models.
 */
export function useConnection(provider: CatalogProvider, onConnected?: (row: AiProvider) => void) {
  const client = useQueryClient();
  // Drafts are kept per provider, so a form can follow the picker without losing typing.
  const [drafts, setDrafts] = useState<Record<string, ConnectionDraft>>({});
  const draft = drafts[provider.id] ?? initialDraft(provider);
  const [touchedId, setTouched] = useState<string | null>(null);
  const touched = touchedId === provider.id;
  const errors = draftErrors(provider, draft);
  const valid = Object.keys(errors).length === 0;
  const test = useMutation({
    mutationFn: (_id: string) => aiAdminApi.providers.testDraft(createBody(provider, draft)),
  });
  const connect = useMutation({
    mutationFn: async () => {
      const row = await aiAdminApi.providers.create(createBody(provider, draft));
      if (row.catalogId !== 'custom' || row.models.length > 0) return row;
      const found = await aiAdminApi.providers.discover(row.id).catch(() => null);
      return found ? { ...row, models: found.models } : row;
    },
    onSuccess: async (row) => {
      await client.invalidateQueries({ queryKey: queryKeys.ai.all() });
      await client.invalidateQueries({ queryKey: queryKeys.me() });
      onConnected?.(row);
    },
  });
  const update = (patch: Partial<ConnectionDraft>) => {
    setDrafts((current) => ({ ...current, [provider.id]: { ...draft, ...patch } }));
    test.reset();
  };
  // A result belongs to the provider it was run for.
  const tested = test.variables === provider.id;
  return {
    provider,
    fields: connectionFields(provider),
    isLocal: provider.id === LOCAL_AI,
    draft,
    update,
    setValue: (name: string, value: string) =>
      update({ values: { ...draft.values, [name]: value } }),
    errors: touched ? errors : {},
    test: {
      run: () => {
        setTouched(provider.id);
        if (valid) test.mutate(provider.id);
      },
      pending: test.isPending,
      result: tested ? (test.data ?? null) : null,
      error: tested && test.error ? describeError(test.error).message : null,
    },
    connect: {
      run: () => {
        setTouched(provider.id);
        if (valid) connect.mutate();
      },
      /** For a caller that goes on once connected (the wizard's primary); null when invalid. */
      runAsync: async () => {
        setTouched(provider.id);
        return valid ? connect.mutateAsync() : null;
      },
      pending: connect.isPending,
      error: connect.error ? describeError(connect.error).message : null,
    },
  };
}

export type Connection = ReturnType<typeof useConnection>;
