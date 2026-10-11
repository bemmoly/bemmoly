import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Actor } from '../../contracts/authz.ts';
import { recordAudit } from '../audit/index.ts';
import type { ModuleCatalog } from '../authz/index.ts';
import type { AuthenticatedToken } from '../identity/index.ts';
import { createSearchService } from '../search/index.ts';
import type { FromModule } from '../../modules/registry.ts';
import type { SearchProviderDefinition } from '../../modules/registries.ts';
import {
  authenticateMcpToken,
  requestedModules,
  resolveMcpSession,
  type McpAccessDeps,
} from './access.ts';
import { serveMcpRequest } from './transport.ts';
import type { McpServices, McpSources } from './types.ts';

export { matchUriTemplate, mcpToolName } from './names.ts';
export type { McpSession, McpSources } from './types.ts';

export interface McpDependencies extends McpAccessDeps {
  /** The module registry: what modules contributed, and their capabilities for authz. */
  modules: ModuleCatalog &
    McpSources & { searchProviders(): FromModule<SearchProviderDefinition>[] };
  /** The app's version, reported to clients in the handshake. */
  version: string;
}

export interface McpRequest {
  token: AuthenticatedToken & { actor: Actor };
  /** The module in `/mcp/:moduleId`, if any. */
  moduleId?: string;
  /** The `?modules=` list, if any. */
  modulesQuery?: string;
  ip?: string;
  requestId?: string;
  raw: { request: IncomingMessage; response: ServerResponse; body: unknown };
}

/** The built-in MCP server: authenticate, resolve the session, then answer over HTTP. */
export function createMcpService(deps: McpDependencies) {
  const services: McpServices = {
    sources: deps.modules,
    search: createSearchService({
      providers: () => deps.modules.searchProviders(),
      isEnabled: deps.isEnabled,
    }),
    async auditWrite(session, tool, input) {
      await recordAudit(deps.db, {
        actor: session.ctx.actor,
        action: 'mcp.tool_called',
        target: { kind: 'mcp_tool', id: tool },
        after: { tool, input },
        meta: session.ctx,
      });
    },
  };
  return {
    authenticate: (header: string | undefined, moduleId?: string) =>
      authenticateMcpToken(deps, header, moduleId),
    /** The 401 challenge: Bearer, and where to find the authorization server when OAuth is on. */
    challenge: (moduleId?: string, error?: string) =>
      deps.oauth ? deps.oauth.challenge(moduleId, error) : 'Bearer realm="bemmoly"',
    /** Resolves the session first, so a refusal is an ordinary HTTP error before any MCP. */
    async prepare(request: Omit<McpRequest, 'raw'>) {
      const requested = requestedModules(request.moduleId, request.modulesQuery);
      const session = await resolveMcpSession(deps, request.token, requested, {
        ...(request.ip ? { ip: request.ip } : {}),
        ...(request.requestId ? { requestId: request.requestId } : {}),
      });
      return {
        serve: (raw: McpRequest['raw']) =>
          serveMcpRequest(services, session, { ...raw, version: deps.version }),
      };
    },
  };
}

export type McpService = ReturnType<typeof createMcpService>;
