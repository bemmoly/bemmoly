import type { CodeHostKind } from '@bemmoly/shared';
import type { AddressPolicy } from '../../clients/guarded-fetch.ts';
import type { RestClientOptions } from '../../clients/rest.ts';
import type {
  CodeActivity,
  CodeCheckReport,
  CodeDeploymentReport,
  CodeEvent,
  CodeHostRepository,
  CodePullRequestInput,
  CodeReadToken,
} from '../../contracts/code-hosts.ts';

/** An inbound request as the webhook route hands it over: headers and the untouched bytes. */
export interface WebhookRequest {
  headers: Readonly<Record<string, string | string[] | undefined>>;
  body: Buffer;
}

/** An activity before the kernel stamps which integration it came through. */
export type ActivityDraft = Omit<CodeActivity, 'integrationId' | 'hostKind'>;

export interface ParsedDelivery {
  event: string;
  action: string | null;
  /** "Pull request #42 opened in acme/api": the delivery log's line. */
  summary: string;
  /** Nothing to link: an event Bemmoly does not use, or a ping. */
  activities: ActivityDraft[];
  /** What happened, for modules that act on events (a push, a pull request, a check). */
  events?: CodeEvent[];
  ping?: boolean;
}

/** The secrets sealed on an integration row. */
export interface HostSecrets {
  webhookSecret: string;
  token?: string;
  privateKey?: string;
}

/** Everything a host's API client needs, decrypted, for one call or one job. */
export interface HostConnection {
  baseUrl: string | null;
  authMode: 'app' | 'token';
  appId: string | null;
  installationId: string | null;
  secrets: HostSecrets;
}

export interface HostApiOptions {
  policy: AddressPolicy;
  signal?: AbortSignal;
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  sleep?: RestClientOptions['sleep'];
}

export interface CodeHostApi {
  /** One cheap authenticated call; resolves to what the host says about the credentials. */
  check(): Promise<string>;
  /** Pull or merge requests of one repository changed since `since`, newest first. */
  recentRequests(repository: string, since: Date, limit: number): Promise<ActivityDraft[]>;
  /** The writes and reads modules make; a host without them is told so by the kernel. */
  reportCheck?(report: CodeCheckReport): Promise<{ externalId: string }>;
  reportDeployment?(report: CodeDeploymentReport): Promise<{ externalId: string }>;
  readFile?(repository: string, path: string, ref: string): Promise<string | null>;
  listFiles?(repository: string, ref: string): Promise<{ paths: string[]; truncated: boolean }>;
  openPullRequest?(input: CodePullRequestInput): Promise<{ url: string; number: number }>;
  /** The repositories the connection can read, asked of the host; archived ones left out. */
  listRepositories?(): Promise<HostRepository[]>;
  /** A read-only credential scoped to one repository, minted fresh for each checkout. */
  readToken?(repository: string): Promise<CodeReadToken | null>;
}

export type HostRepository = Omit<CodeHostRepository, 'hostKind'>;

/**
 * One code host. Adding a host is one driver plus one registry line; its payload shapes and
 * API stay inside its own files.
 */
export interface CodeHostDriver {
  kind: CodeHostKind;
  /** The product's name, for the settings page and the delivery log. */
  label: string;
  /** Where the cloud product lives when the integration has no base URL. */
  cloudUrl: string;
  /** Checks the signature or token over the raw bytes, in constant time. Never parses first. */
  verify(request: WebhookRequest, webhookSecret: string): boolean;
  /** The host's id for this delivery, stable across its redeliveries. */
  deliveryId(request: WebhookRequest): string;
  /** Called only after `verify`. Throws a ValidationError on a body it cannot read. */
  parse(request: WebhookRequest): ParsedDelivery;
  /** A signed ping, built exactly as the host would send it, for the test delivery. */
  ping(webhookSecret: string): WebhookRequest;
  api(connection: HostConnection, options: HostApiOptions): CodeHostApi;
}

/** A header's single value, whatever form the server handed it in. */
export function headerOf(request: WebhookRequest, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/** A base URL without trailing slashes; a loop, not a regex, since the URL is the admin's. */
export function withoutTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') end -= 1;
  return url.slice(0, end);
}

/** The first line of a commit message, as its title. */
export const firstLine = (text: string): string => text.split('\n', 1)[0]?.trim() ?? '';
