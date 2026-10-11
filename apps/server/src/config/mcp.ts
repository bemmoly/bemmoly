import {
  createClientMetadataFetch,
  createMcpService,
  createOAuthService,
  DEFAULT_MCP_RATE_LIMIT,
  DEFAULT_OAUTH_RATE_LIMIT,
  type FetchClientMetadata,
  type KernelRouteDependencies,
  type ModuleRegistry,
} from '@bemmoly/core';
import type { Env } from '@bemmoly/core/config';
import type { DatabaseConnection } from './database.ts';
import type { DataKernel } from './kernel.ts';
import { appVersionOf } from './version.ts';

export interface McpWiringInput {
  env: Pick<
    Env,
    | 'BEMMOLY_VERSION'
    | 'BEMMOLY_PUBLIC_URL'
    | 'BEMMOLY_RATE_LIMIT_MCP_PER_USER'
    | 'BEMMOLY_RATE_LIMIT_OAUTH_PER_IP'
    | 'BEMMOLY_ALLOW_PRIVATE_URLS'
  >;
  database: DatabaseConnection;
  kernel: DataKernel;
  modules: ModuleRegistry;
  /** Tests hand a fetch that serves client metadata documents without a network. */
  fetchClientMetadata?: FetchClientMetadata;
}

const withMax = <T extends { max: number }>(budget: T, max: number | undefined): T =>
  max === undefined ? budget : { ...budget, max };

/**
 * The built-in MCP server on the data kernel, with OAuth sign-in for clients beside personal
 * access tokens. It is wired whatever the AI settings say; Settings › MCP turns it on (off by
 * default) and picks the modules it exposes.
 */
export function wireMcp(input: McpWiringInput): Pick<KernelRouteDependencies, 'mcp'> {
  const { env, database, kernel, modules } = input;
  const access = {
    db: database.db,
    modules,
    isEnabled: (moduleId: string) => kernel.moduleState.isEnabled(moduleId),
    settings: async () => ({
      enabled: await kernel.settings.get('mcp.enabled'),
      modules: await kernel.settings.get('mcp.modules'),
    }),
  };
  const oauth = createOAuthService({
    ...access,
    publicUrl: env.BEMMOLY_PUBLIC_URL,
    moduleName: (id) => modules.get(id)?.module.name ?? id,
    // A client's metadata document is on the public internet; never the LAN unless allowed.
    fetchClientMetadata:
      input.fetchClientMetadata ??
      createClientMetadataFetch(env.BEMMOLY_ALLOW_PRIVATE_URLS ? 'any' : 'public'),
  });
  const service = createMcpService({ ...access, oauth, version: appVersionOf(env) });
  return {
    mcp: {
      service,
      rateLimit: withMax(DEFAULT_MCP_RATE_LIMIT, env.BEMMOLY_RATE_LIMIT_MCP_PER_USER),
      oauth: {
        service: oauth,
        rateLimit: withMax(DEFAULT_OAUTH_RATE_LIMIT, env.BEMMOLY_RATE_LIMIT_OAUTH_PER_IP),
      },
    },
  };
}
