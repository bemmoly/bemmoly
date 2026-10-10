import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

/**
 * A tiny model server on the test machine that speaks the chat-completions protocol "Local
 * server" connects to: a model list, one chat completion and embeddings. It never forwards
 * anything; every answer is canned, so the AI flow runs with no provider at all.
 */
export interface FakeModelServer {
  /** The base URL an admin types into the Local server form, ending in /v1. */
  baseURL: string;
  /** Requests seen, as "METHOD /path", in order. */
  requests: string[];
  stop(): Promise<void>;
}

export const FAKE_MODELS = ['house-chat-small', 'house-chat-large', 'house-embed'] as const;

/** The key the fake accepts; anything else is refused the way a real server refuses it. */
export const FAKE_KEY = 'e2e-local-key';

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function completion(body: Record<string, unknown>) {
  const tools = Array.isArray(body['tools'])
    ? (body['tools'] as { function?: { name?: string } }[])
    : [];
  const tool = tools[0]?.function?.name;
  const wantsJson = Boolean(body['response_format']);
  const message = tool
    ? {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: tool, arguments: '{}' } }],
      }
    : { role: 'assistant', content: wantsJson ? '{"ok":true}' : 'ok' };
  return {
    id: 'chatcmpl-e2e',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: String(body['model'] ?? FAKE_MODELS[0]),
    choices: [{ index: 0, message, finish_reason: tool ? 'tool_calls' : 'stop' }],
    usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10 },
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, seen: string[]) {
  const path = (request.url ?? '/').split('?')[0] ?? '/';
  seen.push(`${request.method ?? 'GET'} ${path}`);
  const auth = request.headers.authorization ?? '';
  if (auth && auth !== `Bearer ${FAKE_KEY}`) {
    send(response, 401, {
      error: { message: 'Invalid API key for this server', type: 'invalid_request_error' },
    });
    return;
  }
  if (request.method === 'GET' && path === '/v1/models') {
    send(response, 200, {
      object: 'list',
      data: FAKE_MODELS.map((id) => ({ id, object: 'model', created: 0, owned_by: 'e2e' })),
    });
    return;
  }
  if (request.method === 'POST' && path === '/v1/chat/completions') {
    send(response, 200, completion(await readJson(request)));
    return;
  }
  if (request.method === 'POST' && path === '/v1/embeddings') {
    const body = await readJson(request);
    const inputs = Array.isArray(body['input']) ? body['input'] : [body['input']];
    send(response, 200, {
      object: 'list',
      model: String(body['model'] ?? 'house-embed'),
      data: inputs.map((_, index) => ({ object: 'embedding', index, embedding: [0.1, 0.2, 0.3] })),
      usage: { prompt_tokens: 4, total_tokens: 4 },
    });
    return;
  }
  send(response, 404, { error: { message: `No route for ${path}`, type: 'not_found' } });
}

/** Starts the fake on 127.0.0.1 (a free port unless one is given); stop() closes it. */
export async function startFakeModelServer(port = 0): Promise<FakeModelServer> {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    handle(request, response, requests).catch(() => send(response, 500, { error: 'fake failed' }));
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  const bound = typeof address === 'object' && address ? address.port : port;
  return {
    baseURL: `http://127.0.0.1:${bound}/v1`,
    requests,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
