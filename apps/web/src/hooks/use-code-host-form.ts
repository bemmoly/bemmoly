import {
  createCodeHostSchema,
  updateCodeHostSchema,
  type CodeHost,
  type CodeHostKind,
  type CreateCodeHostInput,
  type UpdateCodeHostInput,
} from '@bemmoly/shared';
import { useState } from 'react';
import { validateForm, type FieldErrors } from '../lib/errors.ts';

/** The connect form as typed: secrets empty until typed, repositories one per line. */
export interface CodeHostDraft {
  name: string;
  server: 'cloud' | 'self';
  baseUrl: string;
  webhookSecret: string;
  mode: 'app' | 'token';
  appId: string;
  installationId: string;
  privateKey: string;
  token: string;
  repositories: string;
}

const LABEL: Record<CodeHostKind, string> = { github: 'GitHub', gitlab: 'GitLab' };

export function draftFor(kind: CodeHostKind, host?: CodeHost): CodeHostDraft {
  return {
    name: host?.name ?? LABEL[kind],
    server: host?.baseUrl ? 'self' : 'cloud',
    baseUrl: host?.baseUrl ?? '',
    webhookSecret: '',
    mode: host?.authMode ?? (kind === 'github' ? 'app' : 'token'),
    appId: host?.appId ?? '',
    installationId: host?.installationId ?? '',
    privateKey: '',
    token: '',
    repositories: host?.repositories.join('\n') ?? '',
  };
}

/** A long random webhook secret, made in the browser, to paste into the host. */
export function newWebhookSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const lines = (text: string) =>
  text
    .split(/[\s,]+/)
    .map((line) => line.trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);

function credentialsOf(draft: CodeHostDraft) {
  if (draft.mode === 'app') {
    return {
      mode: 'app' as const,
      appId: draft.appId.trim(),
      installationId: draft.installationId.trim(),
      ...(draft.privateKey.trim() ? { privateKey: draft.privateKey.trim() } : {}),
    };
  }
  return { mode: 'token' as const, ...(draft.token.trim() ? { token: draft.token.trim() } : {}) };
}

/** The body: an empty secret, token or key keeps what is stored (only when editing). */
function inputOf(kind: CodeHostKind, draft: CodeHostDraft, host?: CodeHost) {
  // An app Bemmoly created is GitHub's to configure; only its name is edited here.
  if (host?.installUrl) return { name: draft.name.trim() };
  const common = {
    name: draft.name.trim(),
    baseUrl: draft.server === 'self' ? draft.baseUrl.trim().replace(/\/+$/, '') : null,
    credentials: credentialsOf(draft),
    repositories: lines(draft.repositories),
    ...(draft.webhookSecret ? { webhookSecret: draft.webhookSecret } : {}),
  };
  return host ? common : { kind, ...common };
}

export function useCodeHostForm(kind: CodeHostKind, host?: CodeHost) {
  const [draft, setDraft] = useState<CodeHostDraft>(() => draftFor(kind, host));
  const [errors, setErrors] = useState<FieldErrors>({});
  const set =
    <K extends keyof CodeHostDraft>(key: K) =>
    (value: CodeHostDraft[K]) =>
      setDraft((previous) => ({ ...previous, [key]: value }));

  /** The validated body, or null with the field messages shown. */
  function build(): CreateCodeHostInput | UpdateCodeHostInput | null {
    const input = inputOf(kind, draft, host);
    const result = host
      ? validateForm(updateCodeHostSchema, input)
      : validateForm(createCodeHostSchema, input);
    const extra: FieldErrors = {};
    if (!host && !draft.webhookSecret) extra['webhookSecret'] = 'Add or generate a webhook secret';
    if (draft.server === 'self' && !draft.baseUrl.trim()) {
      extra['baseUrl'] = 'Add the address of your server';
    }
    const merged = { ...(result.errors ?? {}), ...extra };
    setErrors(merged);
    if (Object.keys(merged).length > 0) return null;
    return input as CreateCodeHostInput | UpdateCodeHostInput;
  }

  return { draft, set, errors, setErrors, build, editing: Boolean(host) };
}

export type CodeHostForm = ReturnType<typeof useCodeHostForm>;
