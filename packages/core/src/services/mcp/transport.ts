import type { IncomingMessage, ServerResponse } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  getPrompt,
  listPrompts,
  listResources,
  listResourceTemplates,
  readResource,
} from './resources.ts';
import { callTool, listTools } from './tools.ts';
import type { McpServices, McpSession } from './types.ts';

/** The MCP spec's "resource not found" code. */
const RESOURCE_NOT_FOUND = -32002;

const INSTRUCTIONS =
  'Bemmoly is a work platform: Work holds projects and issues, Docs holds spaces and pages. ' +
  'Every call runs as the person who made the token, with their permissions. Use ' +
  'bemmoly.search to find records, then the module tools (work.*, docs.*) to read or change ' +
  'them. Issues and pages are also readable as resources (bemmoly://work/issues/{key}, ' +
  'bemmoly://docs/pages/{id}).';

/** One MCP server per request, its handlers bound to the resolved session. */
function createServer(services: McpServices, session: McpSession, version: string): Server {
  const server = new Server(
    { name: 'bemmoly', title: 'Bemmoly', version },
    { capabilities: { tools: {}, resources: {}, prompts: {} }, instructions: INSTRUCTIONS },
  );
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: listTools(services, session),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await callTool(services, session, request.params.name, request.params.arguments);
    if (!result) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${request.params.name}`);
    }
    return result;
  });
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: await listResources(services, session),
  }));
  server.setRequestHandler(ListResourceTemplatesRequestSchema, () => ({
    resourceTemplates: listResourceTemplates(services, session),
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const content = await readResource(services, session, request.params.uri);
    if (!content) {
      throw new McpError(RESOURCE_NOT_FOUND, 'Resource not found', { uri: request.params.uri });
    }
    return { contents: [content] };
  });
  server.setRequestHandler(ListPromptsRequestSchema, () => ({
    prompts: listPrompts(services, session),
  }));
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const rendered = await getPrompt(
      services,
      session,
      request.params.name,
      request.params.arguments ?? {},
    );
    if (!rendered.found) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${request.params.name}`);
    }
    if (!('messages' in rendered)) {
      throw new McpError(ErrorCode.InvalidParams, `Missing ${rendered.missing.join(', ')}`);
    }
    return {
      description: rendered.description,
      messages: rendered.messages.map((message) => ({
        role: message.role,
        content: { type: 'text' as const, text: message.text },
      })),
    };
  });
  return server;
}

/**
 * Answers one Streamable HTTP POST statelessly: no session id, every request authenticated on
 * its own, so any process of the install can serve any request. Replies are plain JSON.
 */
export async function serveMcpRequest(
  services: McpServices,
  session: McpSession,
  http: { request: IncomingMessage; response: ServerResponse; body: unknown; version: string },
): Promise<void> {
  const server = createServer(services, session, http.version);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  http.response.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(http.request, http.response, http.body);
}
