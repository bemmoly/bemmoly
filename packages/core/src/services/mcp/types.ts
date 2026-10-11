import type { FromModule } from '../../modules/registry.ts';
import type { AiContribution } from '../../modules/registries.ts';
import type { McpPromptDefinition, McpResourceDefinition } from '../../modules/mcp.ts';
import type { RequestContext } from '../authz/index.ts';
import type { SearchService } from '../search/index.ts';

/** Where the MCP server finds what modules contributed; the kernel never imports a module. */
export interface McpSources {
  aiTools(): FromModule<AiContribution>[];
  mcpTools(): FromModule<AiContribution>[];
  mcpResources(): FromModule<McpResourceDefinition>[];
  mcpPrompts(): FromModule<McpPromptDefinition>[];
}

/**
 * One client request, resolved: who it runs as, the modules it may reach (already narrowed by
 * the admin's choice, the token, the URL and the person's grants) and whether it may write.
 */
export interface McpSession {
  ctx: RequestContext;
  /** The person's name, for "via MCP for Rohan" on anything a write signs. */
  personName: string;
  modules: ReadonlySet<string>;
  writable: boolean;
}

export interface McpServices {
  sources: McpSources;
  search: SearchService;
  /** Records one audit row per write a client makes. */
  auditWrite(session: McpSession, tool: string, input: unknown): Promise<void>;
}

/** The kernel's own namespace, served on every connection. */
export const KERNEL_NAMESPACE = 'bemmoly';
