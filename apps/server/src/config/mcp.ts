import {
  createMcpService,
  DEFAULT_MCP_RATE_LIMIT,
  type KernelRouteDependencies,
  type ModuleRegistry,
} from '@bemmoly/core';
import type { Env } from '@bemmoly/core/config';
import type { DatabaseConnection } from './database.ts';
import type { DataKernel } from './kernel.ts';
import { appVersionOf } from './version.ts';

export interface McpWiringInput {
  env: Pick<Env, 'BEMMOLY_VERSION' | 'BEMMOLY_RATE_LIMIT_MCP_PER_USER'>;
  database: DatabaseConnection;
  kernel: DataKernel;
  modules: ModuleRegistry;
}

/**
 * The built-in MCP server on the data kernel. It is wired whatever the AI settings say;
 * Settings › MCP turns it on (off by default) and picks the modules it exposes.
 */
export function wireMcp(input: McpWiringInput): Pick<KernelRouteDependencies, 'mcp'> {
  const { env, database, kernel, modules } = input;
  const service = createMcpService({
    db: database.db,
    modules,
    isEnabled: (moduleId) => kernel.moduleState.isEnabled(moduleId),
    settings: async () => ({
      enabled: await kernel.settings.get('mcp.enabled'),
      modules: await kernel.settings.get('mcp.modules'),
    }),
    version: appVersionOf(env),
  });
  const max = env.BEMMOLY_RATE_LIMIT_MCP_PER_USER;
  return {
    mcp: {
      service,
      rateLimit: max === undefined ? DEFAULT_MCP_RATE_LIMIT : { ...DEFAULT_MCP_RATE_LIMIT, max },
    },
  };
}
