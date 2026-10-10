import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

/*
 * A model server on this machine for the editor AI flow: the chat-completions protocol a
 * Local server speaks, answering by which editor prompt it was sent (ghost text, a write, a
 * comment fix), with streaming as server-sent events. Nothing is forwarded anywhere.
 */

export const GHOST = ' behind the session.store flag.';
export const WRITTEN = 'Sessions move to Postgres behind a flag, with dual writes first.';
export const FIX = { replacement: 'every 90 days', rationale: 'The policy says 90 days.' };

export interface EditorAiModel {
  baseURL: string;
  /** The system prompts received, in order. */
  prompts: string[];
  stop(): Promise<void>;
}

interface ChatBody {
  stream?: boolean;
  model?: string;
  messages?: { role: string; content: unknown }[];
}

async function readBody(request: IncomingMessage): Promise<ChatBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as ChatBody;
  } catch {
    return {};
  }
}

const textOf = (content: unknown) =>
  typeof content === 'string' ? content : JSON.stringify(content ?? '');

function answerFor(system: string): string {
  if (system.includes('continue a person')) return GHOST;
  if (system.includes('comment thread')) return JSON.stringify(FIX);
  return WRITTEN;
}

const USAGE = { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 };

function chunk(model: string, delta: object, finish: string | null) {
  return {
    id: 'chatcmpl-editor-e2e',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finish }],
    ...(finish ? { usage: USAGE } : {}),
  };
}

async function stream(response: ServerResponse, model: string, text: string) {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const send = (data: unknown) => response.write(`data: ${JSON.stringify(data)}\n\n`);
  send(chunk(model, { role: 'assistant', content: '' }, null));
  for (const word of text.split(/(?<= )/)) {
    await new Promise((resolve) => setTimeout(resolve, 60));
    send(chunk(model, { content: word }, null));
  }
  send(chunk(model, {}, 'stop'));
  response.end('data: [DONE]\n\n');
}

async function handle(request: IncomingMessage, response: ServerResponse, prompts: string[]) {
  const path = (request.url ?? '/').split('?')[0] ?? '/';
  const json = (status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  if (request.method === 'GET' && path === '/v1/models') {
    json(200, { object: 'list', data: [{ id: 'house-chat-small', object: 'model', created: 0 }] });
    return;
  }
  if (request.method !== 'POST' || path !== '/v1/chat/completions') {
    json(404, { error: { message: `No route for ${path}` } });
    return;
  }
  const body = await readBody(request);
  const system = (body.messages ?? [])
    .filter((message) => message.role === 'system')
    .map((message) => textOf(message.content))
    .join('\n');
  prompts.push(system);
  const model = body.model ?? 'house-chat-small';
  const text = answerFor(system);
  if (body.stream) {
    await stream(response, model, text);
    return;
  }
  json(200, {
    id: 'chatcmpl-editor-e2e',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
    usage: USAGE,
  });
}

export async function startEditorAiModel(): Promise<EditorAiModel> {
  const prompts: string[] = [];
  const server = createServer((request, response) => {
    handle(request, response, prompts).catch(() => {
      response.writeHead(500);
      response.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    baseURL: `http://127.0.0.1:${port}/v1`,
    prompts,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
