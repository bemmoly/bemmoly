import { randomUUID } from 'node:crypto';
import { searchRequestQuerySchema } from '@bemmoly/shared';
import { z } from 'zod';
import { defineReadTool, isAiToolDefinition } from '../ai/tools/define.ts';
import { isExpectedToolError } from '../ai/tools/registry.ts';
import type { AiToolDefinition, AiToolRunContext } from '../ai/tools/types.ts';
import { mcpToolName } from './names.ts';
import { KERNEL_NAMESPACE, type McpServices, type McpSession } from './types.ts';

/*
 * MCP tools are the AI tools modules already register (`ctx.ai.addTool`), served under dotted
 * names, plus any MCP-only tools and the kernel's search. The same zod schemas validate a
 * client's arguments, so a tool accepts nothing its endpoint would refuse. Unlike the palette,
 * an MCP client runs write tools directly: the person confirms in their own client, and the
 * services make the same checks they make for the UI.
 */

export interface McpTool {
  name: string;
  moduleId: string;
  definition: AiToolDefinition;
}

export interface McpToolListing {
  name: string;
  title?: string;
  description: string;
  inputSchema: { type: 'object'; [key: string]: unknown };
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean };
}

export interface McpToolResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

const searchInput = searchRequestQuerySchema.pick({ q: true, limit: true });

function kernelTools(services: McpServices): McpTool[] {
  const search = defineReadTool({
    name: 'bemmoly.search',
    kind: 'read',
    description:
      'Search everything this connection can reach (issues, pages and more) by words in the ' +
      'title or key. Returns kind, title, key and an id to pass to the module tools.',
    input: searchInput,
    execute: async (ctx, input) =>
      (await services.search.search(ctx, { q: input.q, limit: input.limit, kinds: undefined })).map(
        (hit) => ({
          kind: hit.kind,
          id: hit.id,
          key: hit.key ?? null,
          title: hit.title,
          subtitle: hit.subtitle,
          href: hit.href,
        }),
      ),
  });
  return [
    { name: search.name, moduleId: KERNEL_NAMESPACE, definition: search as AiToolDefinition },
  ];
}

/** The tools this session may see: its modules' tools, writes only when it may write. */
export function toolsFor(services: McpServices, session: McpSession): McpTool[] {
  const fromModules = [...services.sources.aiTools(), ...services.sources.mcpTools()]
    .filter((entry) => session.modules.has(entry.moduleId))
    .filter((entry) => isAiToolDefinition(entry.definition))
    .map((entry) => ({
      name: mcpToolName(entry.name),
      moduleId: entry.moduleId,
      definition: entry.definition as AiToolDefinition,
    }));
  const seen = new Set<string>();
  return [...kernelTools(services), ...fromModules].filter((tool) => {
    if (seen.has(tool.name)) return false;
    seen.add(tool.name);
    return tool.definition.kind === 'read' || session.writable;
  });
}

function inputSchemaOf(definition: AiToolDefinition): McpToolListing['inputSchema'] {
  const schema = z.toJSONSchema(definition.input, { io: 'input', unrepresentable: 'any' });
  const { $schema: _ignored, ...rest } = schema as Record<string, unknown>;
  return { ...rest, type: 'object' };
}

export function listTools(services: McpServices, session: McpSession): McpToolListing[] {
  return toolsFor(services, session).map((tool) => ({
    name: tool.name,
    description: tool.definition.description,
    inputSchema: inputSchemaOf(tool.definition),
    annotations: {
      readOnlyHint: tool.definition.kind === 'read',
      destructiveHint: false,
      idempotentHint: tool.definition.kind === 'read' || tool.definition.idempotent,
    },
  }));
}

const text = (value: unknown, isError = false): McpToolResult => ({
  content: [
    { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
  ],
  ...(isError ? { isError: true } : {}),
});

function runContext(session: McpSession): AiToolRunContext {
  return {
    ...session.ctx,
    planId: randomUUID(),
    stepIndex: 0,
    attribution: `via MCP for ${session.personName}`,
    runId: null,
  };
}

/**
 * Calls one tool as the session's person. A refusal or a bad argument comes back as a tool
 * error the client's model can read; anything unexpected fails the request.
 */
export async function callTool(
  services: McpServices,
  session: McpSession,
  name: string,
  args: unknown,
): Promise<McpToolResult | null> {
  const tool = toolsFor(services, session).find((candidate) => candidate.name === name);
  if (!tool) return null;
  const parsed = tool.definition.input.safeParse(args ?? {});
  if (!parsed.success) return text(`Invalid arguments: ${z.prettifyError(parsed.error)}`, true);
  try {
    const definition = tool.definition;
    if (definition.kind === 'read') return text(await definition.execute(session.ctx, parsed.data));
    await definition.authorize(session.ctx, parsed.data);
    const preview = await definition.describe(session.ctx, parsed.data).catch(() => null);
    await definition.run(runContext(session), parsed.data);
    await services.auditWrite(session, tool.name, parsed.data);
    return text({ done: true, ...(preview ? { change: preview } : {}) });
  } catch (error) {
    if (isExpectedToolError(error)) return text(error.message, true);
    throw error;
  }
}
