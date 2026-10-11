import type { ImportConnection, ImportSourceContext } from '@bemmoly/core';
import { HttpStatusError } from '@bemmoly/core';
import { ProviderError, ValidationError, type ImportField } from '@bemmoly/shared';
import { createJiraClient, type JiraClient, type JiraDeployment } from '../../../clients/jira.ts';

/** The connection form Settings › Import draws for Jira. */
export const JIRA_FIELDS: readonly ImportField[] = [
  {
    name: 'deployment',
    label: 'Hosting',
    kind: 'select',
    required: true,
    options: [
      { value: 'cloud', label: 'Cloud' },
      { value: 'datacenter', label: 'Data Center or Server' },
    ],
  },
  {
    name: 'url',
    label: 'Site address',
    kind: 'url',
    required: true,
    placeholder: 'https://your-site.example.net',
  },
  {
    name: 'email',
    label: 'Account email',
    kind: 'email',
    required: true,
    showWhen: { field: 'deployment', values: ['cloud'] },
  },
  {
    name: 'token',
    label: 'API token',
    kind: 'secret',
    required: true,
    help: 'Cloud: an API token from your account settings. Data Center: a personal access token. Read access is enough.',
  },
];

export interface JiraConnection {
  deployment: JiraDeployment;
  baseUrl: string;
  email?: string;
  token: string;
}

/** "https://acme.example.net/jira/" → "https://acme.example.net/jira", the site's identity. */
export function normalizeSiteUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ValidationError('The site address is not a URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ValidationError('The site address must start with https://');
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`.toLowerCase();
}

export function parseJiraConnection(connection: ImportConnection): JiraConnection {
  const deployment = connection['deployment'] === 'datacenter' ? 'datacenter' : 'cloud';
  const token = connection['token'] ?? '';
  if (!token) throw new ValidationError('The API token is required');
  return {
    deployment,
    baseUrl: normalizeSiteUrl(connection['url'] ?? ''),
    token,
    ...(connection['email'] ? { email: connection['email'] } : {}),
  };
}

export function jiraClientFor(connection: ImportConnection, ctx: ImportSourceContext): JiraClient {
  const parsed = parseJiraConnection(connection);
  return createJiraClient({
    ...parsed,
    fetch: ctx.fetchFor(parsed.deployment === 'cloud' ? 'public' : 'local'),
    signal: ctx.signal,
  });
}

/** A failed call to the source, said so the admin knows what to fix. */
export function explainJiraError(error: unknown): never {
  if (error instanceof HttpStatusError) {
    if (error.status === 401 || error.status === 403) {
      throw new ValidationError('Jira refused the credentials; check the email and token', {
        cause: error,
      });
    }
    if (error.status === 404) {
      throw new ValidationError('No Jira answered at that address; check the site address', {
        cause: error,
      });
    }
    throw new ProviderError(`Jira answered ${error.status}`, { cause: error });
  }
  if (error instanceof ValidationError) throw error;
  throw new ProviderError(
    `Could not reach Jira: ${error instanceof Error ? error.message : String(error)}`,
    { cause: error },
  );
}
