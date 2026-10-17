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
import type { ConnectionRecord, DeployTarget } from '../contract.ts';

/*
 * What the Google Cloud provider knows about one connection: its parsed config, clients
 * acting as the control identity, and clients acting as each environment's deployer. Built
 * once per connection and config, so tokens are reused across calls.
 */

export const gcpConnectionConfigSchema = z.object({
  organizationId: z.string().min(1),
  billingAccountId: z.string().min(1),
  folderName: z.string().min(1).default('Bemmoly'),
  /** Used where an environment names no region. */
  region: z.string().min(1).default('us-central1'),
  /**
   * Projects the billing account may pay for. Google publishes no API for this limit; new
   * billing accounts start with a handful, so an admin who has an increase records it here.
   */
  projectQuota: z.number().int().positive().default(5),
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
}

export interface GcpContext {
  config: GcpConnectionConfig;
  control: GcpClients;
  /** The control identity's email; null when federation has no service account behind it. */
  principal(): Promise<string | null>;
  /** Clients acting as `deployer@<project>` for every deploy call in that project. */
  deployer(projectId: string): GcpClients;
}

export function parseGcpConfig(connection: ConnectionRecord): GcpConnectionConfig {
  const parsed = gcpConnectionConfigSchema.safeParse(connection.config);
  if (!parsed.success) {
    throw new ValidationError(
      `${connection.name} is missing its organization or billing account; reconnect it`,
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
      deployer(projectId) {
        let clients = deployers.get(projectId);
        if (!clients) {
          const email = serviceAccountEmail('deployer', projectId);
          clients = createGcpClients({
            tokens: impersonatedTokens(control.iamCredentials, email),
            ...clientOptions,
          });
          deployers.set(projectId, clients);
        }
        return clients;
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
  };
}
