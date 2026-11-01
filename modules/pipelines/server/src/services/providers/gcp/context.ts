import { ValidationError } from '@bemmoly/shared';
import { z } from 'zod';
import {
  createGcpClients,
  createTokenSource,
  gcpCredentialsSchema,
  impersonatedTokens,
  serviceAccountEmail,
  type GcpClients,
  type GcpTokenSource,
  type GcpTransport,
  type PollOptions,
} from '../../../clients/gcp/index.ts';
import type { KubernetesTransport } from '../../../clients/kubernetes/index.ts';
import type { ConnectionRecord, DeployTarget } from '../contract.ts';

/*
 * What the Google Cloud provider knows about one connection: its parsed config, clients
 * acting as the control identity, and clients acting as each environment's deployer. Built
 * once per connection and config, so tokens are reused across calls.
 */

export const gcpConnectionConfigSchema = z.object({
  /** Attached connections deploy into projects that exist and create nothing. */
  mode: z.enum(['managed', 'attached']).default('managed'),
  /** Empty on attached connections, which never create folders or projects. */
  organizationId: z.string().default(''),
  billingAccountId: z.string().default(''),
  folderName: z.string().min(1).default('Bemmoly'),
  /**
   * The folder bootstrap.sh made and granted Bemmoly roles on, as digits. Connections made
   * before it named only the organisation, and Pipelines created the folder there itself.
   */
  folderId: z.string().default(''),
  /** Used where an environment names no region. */
  region: z.string().min(1).default('us-central1'),
  /**
   * Projects the billing account may pay for, when an admin has recorded it. Google publishes
   * no API for this limit, so without it the plan compares against the usual default.
   */
  projectQuota: z.number().int().positive().optional(),
  credentials: gcpCredentialsSchema,
  /** Service Monitoring SLO names by application key; no entry means no error budget. */
  slos: z.record(z.string(), z.string()).default({}),
});

export type GcpConnectionConfig = z.infer<typeof gcpConnectionConfigSchema>;

export interface GcpProviderOptions {
  transport?: GcpTransport;
  timeoutMs?: number;
  poll?: Partial<PollOptions>;
  /** Replaces the connection's own keyless credentials; tests hand in a fixed token. */
  tokensFor?: (connection: ConnectionRecord, config: GcpConnectionConfig) => GcpTokenSource;
  /** Bemmoly's signed token, for connections that federate without a credential file. */
  subjectToken?: () => Promise<string>;
  /** How to reach a cluster's API server given its CA; tests replay recorded answers. */
  kubernetesTransport?: (caPem: string) => KubernetesTransport;
}

/** Who Pipelines acts as inside one attached project, from that account's config. */
export const accountConfigSchema = z.object({
  deployerServiceAccount: z.string().min(1).nullable().default(null),
  runtimeServiceAccount: z.string().min(1).nullable().default(null),
});

export type GcpAccountConfig = z.infer<typeof accountConfigSchema>;

export const accountConfigOf = (config: unknown): GcpAccountConfig =>
  accountConfigSchema
    .catch({ deployerServiceAccount: null, runtimeServiceAccount: null })
    .parse(config ?? {});

export interface GcpContext {
  config: GcpConnectionConfig;
  control: GcpClients;
  /** The control identity's email; null when federation has no service account behind it. */
  principal(): Promise<string | null>;
  /**
   * Clients for deploy calls in one project. A managed project's deployer is
   * `deployer@<project>`; an attached one uses the deployer its account names, or the
   * connection's own identity when it names none.
   */
  deployer(projectId: string, account?: GcpAccountConfig): GcpClients;
  /** Who services run as there; null leaves Cloud Run's default. */
  runtimeAccount(projectId: string, account?: GcpAccountConfig): string | null;
}

export function parseGcpConfig(connection: ConnectionRecord): GcpConnectionConfig {
  const parsed = gcpConnectionConfigSchema.safeParse(connection.config);
  const managedWithout =
    parsed.success &&
    parsed.data.mode === 'managed' &&
    ((!parsed.data.folderId && !parsed.data.organizationId) || !parsed.data.billingAccountId);
  if (!parsed.success || managedWithout) {
    throw new ValidationError(
      `${connection.name} is missing its folder or billing account; connect it again with the values bootstrap.sh printed`,
    );
  }
  return parsed.data;
}

export function createGcpContexts(options: GcpProviderOptions) {
  const cache = new Map<string, GcpContext>();
  const clientOptions = {
    ...(options.transport ? { transport: options.transport } : {}),
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.poll ? { poll: options.poll } : {}),
  };

  function build(connection: ConnectionRecord): GcpContext {
    const config = parseGcpConfig(connection);
    const tokens = options.tokensFor
      ? options.tokensFor(connection, config)
      : createTokenSource(config.credentials, {
          ...clientOptions,
          ...(options.subjectToken ? { subjectToken: options.subjectToken } : {}),
        });
    const control = createGcpClients({ tokens, ...clientOptions });
    const deployers = new Map<string, GcpClients>();
    let principal: Promise<string | null> | null = null;
    return {
      config,
      control,
      principal() {
        principal ??= control.sts.whoAmI(tokens).catch((error: unknown) => {
          principal = null;
          throw error;
        });
        return principal;
      },
      deployer(projectId, account) {
        const email =
          account?.deployerServiceAccount ??
          (config.mode === 'managed' ? serviceAccountEmail('deployer', projectId) : null);
        if (!email) return control;
        let clients = deployers.get(email);
        if (!clients) {
          clients = createGcpClients({
            tokens: impersonatedTokens(control.iamCredentials, email),
            ...clientOptions,
          });
          deployers.set(email, clients);
        }
        return clients;
      },
      runtimeAccount(projectId, account) {
        if (account?.runtimeServiceAccount) return account.runtimeServiceAccount;
        return config.mode === 'managed' ? serviceAccountEmail('runtime', projectId) : null;
      },
    };
  }

  return (connection: ConnectionRecord): GcpContext => {
    const key = `${connection.id}:${JSON.stringify(connection.config)}`;
    let context = cache.get(key);
    if (!context) {
      context = build(connection);
      cache.set(key, context);
    }
    return context;
  };
}

export type GcpContexts = ReturnType<typeof createGcpContexts>;

/** The project and region one deploy target lives in; both must be known before a deploy. */
export function placeOf(target: DeployTarget, config: GcpConnectionConfig) {
  if (!target.account) {
    throw new ValidationError(
      `${target.environment.key} has no Google Cloud project yet; apply the landing zone first`,
    );
  }
  return {
    projectId: target.account.externalId,
    region: target.environment.region ?? config.region,
    service: target.application.key,
    account: accountConfigOf(target.account.config),
  };
}
