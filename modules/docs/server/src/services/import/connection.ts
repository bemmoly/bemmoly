import { HttpStatusError, type ImportConnection, type ImportSourceContext } from '@bemmoly/core';
import { ProviderError, ValidationError, type ImportField } from '@bemmoly/shared';
import {
  createConfluenceClient,
  type ConfluenceClient,
  type ConfluenceDeployment,
} from '../../clients/confluence.ts';

/** The connection form Settings › Import draws for Confluence. */
export const CONFLUENCE_FIELDS: readonly ImportField[] = [
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

export interface ConfluenceConnection {
  deployment: ConfluenceDeployment;
  baseUrl: string;
  email?: string;
  token: string;
}

export function parseConfluenceConnection(connection: ImportConnection): ConfluenceConnection {
  let url: URL;
  try {
    url = new URL((connection['url'] ?? '').trim());
  } catch {
    throw new ValidationError('The site address is not a URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ValidationError('The site address must start with https://');
  }
  const token = connection['token'] ?? '';
  if (!token) throw new ValidationError('The API token is required');
  return {
    deployment: connection['deployment'] === 'datacenter' ? 'datacenter' : 'cloud',
    baseUrl: `${url.origin}${url.pathname.replace(/\/+$/, '')}`.toLowerCase(),
    token,
    ...(connection['email'] ? { email: connection['email'] } : {}),
  };
}

export function confluenceClientFor(
  connection: ImportConnection,
  ctx: ImportSourceContext,
): ConfluenceClient {
  const parsed = parseConfluenceConnection(connection);
  return createConfluenceClient({
    ...parsed,
    fetch: ctx.fetchFor(parsed.deployment === 'cloud' ? 'public' : 'local'),
    signal: ctx.signal,
  });
}

export function explainConfluenceError(error: unknown): never {
  if (error instanceof HttpStatusError) {
    if (error.status === 401 || error.status === 403) {
      throw new ValidationError('Confluence refused the credentials; check the email and token', {
        cause: error,
      });
    }
    if (error.status === 404) {
      throw new ValidationError('No Confluence answered at that address; check the site address', {
        cause: error,
      });
    }
    throw new ProviderError(`Confluence answered ${error.status}`, { cause: error });
  }
  if (error instanceof ValidationError) throw error;
  throw new ProviderError(
    `Could not reach Confluence: ${error instanceof Error ? error.message : String(error)}`,
    { cause: error },
  );
}

/** Work's and Docs' key rules: an uppercase letter, then 1–9 uppercase letters or digits. */
export function spaceKeyFrom(key: string): string {
  const cleaned = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const lead = /^[A-Z]/.test(cleaned) ? cleaned : `S${cleaned}`;
  return lead.padEnd(2, 'X').slice(0, 10);
}
