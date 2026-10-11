import { ForbiddenError, NotFoundError } from '@bemmoly/shared';
import type { McpPromptMessage } from '../../modules/mcp.ts';
import { matchUriTemplate } from './names.ts';
import type { McpServices, McpSession } from './types.ts';

/*
 * Resources and prompts modules contributed with `ctx.mcp`, narrowed to the session's modules.
 * Reads run as the person, so a record they cannot open answers like the API: not found.
 */

const resourcesOf = (services: McpServices, session: McpSession) =>
  services.sources.mcpResources().filter((resource) => session.modules.has(resource.moduleId));

const promptsOf = (services: McpServices, session: McpSession) =>
  services.sources.mcpPrompts().filter((prompt) => session.modules.has(prompt.moduleId));

const DEFAULT_MIME = 'text/markdown';

export async function listResources(services: McpServices, session: McpSession) {
  const lists = await Promise.all(
    resourcesOf(services, session).map(async (resource) => {
      if (!resource.list) return [];
      try {
        const entries = await resource.list(session.ctx);
        return entries.map((entry) => ({
          ...entry,
          mimeType: resource.mimeType ?? DEFAULT_MIME,
        }));
      } catch (error) {
        if (error instanceof ForbiddenError || error instanceof NotFoundError) return [];
        throw error;
      }
    }),
  );
  return lists.flat();
}

export function listResourceTemplates(services: McpServices, session: McpSession) {
  return resourcesOf(services, session).map((resource) => ({
    uriTemplate: resource.uriTemplate,
    name: resource.name,
    title: resource.title,
    description: resource.description,
    mimeType: resource.mimeType ?? DEFAULT_MIME,
  }));
}

/** The resource's contents, or null when no reachable module serves the URI. */
export async function readResource(services: McpServices, session: McpSession, uri: string) {
  for (const resource of resourcesOf(services, session)) {
    const params = matchUriTemplate(resource.uriTemplate, uri);
    if (!params) continue;
    try {
      const content = await resource.read(session.ctx, params);
      return { uri, mimeType: content.mimeType ?? resource.mimeType ?? DEFAULT_MIME, ...content };
    } catch (error) {
      // A record the person may not open is reported like one that is not there.
      if (error instanceof ForbiddenError || error instanceof NotFoundError) return null;
      throw error;
    }
  }
  return null;
}

export function listPrompts(services: McpServices, session: McpSession) {
  return promptsOf(services, session).map((prompt) => ({
    name: prompt.name,
    title: prompt.title,
    description: prompt.description,
    arguments: prompt.arguments.map((argument) => ({ ...argument })),
  }));
}

export type RenderedPrompt =
  | { found: false }
  | { found: true; missing: string[] }
  | { found: true; missing: []; description: string; messages: McpPromptMessage[] };

export async function getPrompt(
  services: McpServices,
  session: McpSession,
  name: string,
  args: Readonly<Record<string, string>>,
): Promise<RenderedPrompt> {
  const prompt = promptsOf(services, session).find((candidate) => candidate.name === name);
  if (!prompt) return { found: false };
  const missing = prompt.arguments
    .filter((argument) => argument.required && !args[argument.name])
    .map((argument) => argument.name);
  if (missing.length > 0) return { found: true, missing };
  return {
    found: true,
    missing: [],
    description: prompt.description,
    messages: await prompt.render(session.ctx, args),
  };
}
