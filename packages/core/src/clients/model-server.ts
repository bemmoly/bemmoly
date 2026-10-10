/**
 * A model server on the admin's network (a "Local server"): lists the models it has loaded.
 * OpenAI-compatible servers answer GET <base>/models; Anthropic-compatible ones answer
 * GET <base>/models with their own envelope. Both return `{ data: [{ id, ... }] }`.
 */
export interface ServerModel {
  id: string;
  name: string;
  contextWindow: number | null;
  /** True when the server says it is an embedding model. */
  embedding: boolean;
}

export interface ModelServerClient {
  listModels(options: {
    baseUrl: string;
    protocol: 'openai-compatible' | 'anthropic-compatible';
    apiKey: string | null;
    headers: Readonly<Record<string, string>>;
    timeoutMs: number;
  }): Promise<ServerModel[]>;
}

export class ModelServerError extends Error {
  override readonly name = 'ModelServerError';
  readonly status: number | null;

  constructor(message: string, status: number | null = null, options?: ErrorOptions) {
    super(message, options);
    this.status = status;
  }
}

const MAX_BYTES = 4 * 1024 * 1024;

interface RawModel {
  id?: unknown;
  display_name?: unknown;
  name?: unknown;
  context_length?: unknown;
  context_window?: unknown;
  max_model_len?: unknown;
  type?: unknown;
}

function toModel(raw: RawModel): ServerModel | null {
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  const context = [raw.context_length, raw.context_window, raw.max_model_len].find(
    (value): value is number => typeof value === 'number' && value > 0,
  );
  const name =
    typeof raw.display_name === 'string'
      ? raw.display_name
      : typeof raw.name === 'string'
        ? raw.name
        : raw.id;
  return {
    id: raw.id,
    name,
    contextWindow: context ?? null,
    embedding: raw.type === 'embedding' || /embed/i.test(raw.id),
  };
}

export function createModelServerClient(): ModelServerClient {
  return {
    async listModels({ baseUrl, protocol, apiKey, headers, timeoutMs }) {
      const url = `${baseUrl.replace(/\/+$/, '')}/models`;
      const auth: Record<string, string> = apiKey
        ? protocol === 'anthropic-compatible'
          ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
          : { authorization: `Bearer ${apiKey}` }
        : {};
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { accept: 'application/json', ...headers, ...auth },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw new ModelServerError(`${url} could not be reached`, null, { cause: error });
      }
      const text = await response.text();
      if (text.length > MAX_BYTES) throw new ModelServerError(`${url} answered too much`);
      if (!response.ok) {
        throw new ModelServerError(`${url} answered ${response.status}`, response.status);
      }
      let body: { data?: unknown; models?: unknown };
      try {
        body = JSON.parse(text) as typeof body;
      } catch (error) {
        throw new ModelServerError(`${url} did not answer JSON`, response.status, { cause: error });
      }
      const list = Array.isArray(body.data)
        ? body.data
        : Array.isArray(body.models)
          ? body.models
          : [];
      return (list as RawModel[])
        .map(toModel)
        .filter((model): model is ServerModel => model !== null);
    },
  };
}
