import type { RequestContext } from '../services/authz/index.ts';
import type { AiContribution } from './registries.ts';

/*
 * What a module offers MCP clients beyond its AI tools, which MCP serves as they are. Every
 * entry is namespaced by its module, so a client connected to one module sees only that
 * module's tools, resources and prompts.
 */

/** One concrete resource a client can list: a project, a space. */
export interface McpResourceEntry {
  uri: string;
  name: string;
  title?: string;
  description?: string;
}

/** What reading a resource returns: text, Markdown by default. */
export interface McpResourceContent {
  text: string;
  mimeType?: string;
}

export interface McpResourceDefinition {
  /** Namespaced by module: "work.issue". */
  name: string;
  title: string;
  description: string;
  /**
   * A level-one URI template under the module: `bemmoly://work/issues/{key}`. Each variable
   * matches one path segment.
   */
  uriTemplate: string;
  mimeType?: string;
  /** The resources a client may browse, as the person sees them; omitted for unbounded kinds. */
  list?(ctx: RequestContext): Promise<McpResourceEntry[]>;
  /** Reads one, as the person: throws NotFoundError or ForbiddenError like the API. */
  read(ctx: RequestContext, params: Readonly<Record<string, string>>): Promise<McpResourceContent>;
}

export interface McpPromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface McpPromptMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface McpPromptDefinition {
  /** Namespaced by module: "work.triage". */
  name: string;
  title: string;
  description: string;
  arguments: readonly McpPromptArgument[];
  render(ctx: RequestContext, args: Readonly<Record<string, string>>): Promise<McpPromptMessage[]>;
}

/** `ctx.mcp`: contributions recorded at boot; the kernel's MCP server reads them per request. */
export interface McpRegistry {
  addResource(resource: McpResourceDefinition): void;
  addPrompt(prompt: McpPromptDefinition): void;
  /** A tool for MCP clients only, built like an AI tool (`aiToolContribution`). */
  addTool(tool: AiContribution): void;
}
