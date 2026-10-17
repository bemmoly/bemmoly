import { request as httpRequest, type IncomingMessage } from 'node:http';
import { NotFoundError, ProviderError } from '@bemmoly/shared';

const PROVIDER = 'docker';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface DockerCall {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * The Docker Engine API over its unix socket, with node:http and nothing else: the runner needs
 * a handful of calls, and a socket path is all Colima, Docker Desktop and Linux have in common.
 */
export class DockerEngine {
  readonly socketPath: string;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  /** True when a daemon answers on the socket within the timeout. */
  async ping(timeoutMs = 2_000): Promise<boolean> {
    try {
      const response = await this.open({ method: 'GET', path: '/_ping', timeoutMs });
      response.resume();
      return response.statusCode === 200;
    } catch {
      return false;
    }
  }

  /** A call whose answer is JSON (or nothing); a status of 400 or more throws. */
  async json<T>(call: DockerCall): Promise<T | undefined> {
    const response = await this.open(call);
    const text = await readAll(response);
    if ((response.statusCode ?? 500) >= 400) throw toError(response.statusCode ?? 500, text);
    return text.length === 0 ? undefined : (JSON.parse(text) as T);
  }

  /** A call whose answer streams (logs, pull progress); the caller reads and ends it. */
  async stream(call: DockerCall): Promise<IncomingMessage> {
    const response = await this.open(call);
    if ((response.statusCode ?? 500) >= 400) {
      throw toError(response.statusCode ?? 500, await readAll(response));
    }
    return response;
  }

  private open(call: DockerCall): Promise<IncomingMessage> {
    const timeout = AbortSignal.timeout(call.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const signal = call.signal ? AbortSignal.any([timeout, call.signal]) : timeout;
    const body = call.body === undefined ? undefined : JSON.stringify(call.body);
    return new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          socketPath: this.socketPath,
          path: call.path,
          method: call.method,
          signal,
          headers: {
            host: 'docker',
            ...(body === undefined
              ? {}
              : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }),
          },
        },
        resolve,
      );
      req.on('error', (error) =>
        reject(
          new ProviderError(`Docker did not answer on ${this.socketPath}: ${error.message}`, {
            provider: PROVIDER,
            cause: error,
          }),
        ),
      );
      req.end(body);
    });
  }
}

function readAll(response: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => chunks.push(chunk));
    response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    response.on('error', reject);
  });
}

function toError(status: number, text: string): Error {
  let message = text.trim() || `Docker answered ${status}`;
  try {
    const parsed = JSON.parse(text) as { message?: unknown };
    if (typeof parsed.message === 'string') message = parsed.message;
  } catch {
    // Plain text: keep it as the message.
  }
  if (status === 404) return new NotFoundError(message, { details: { provider: PROVIDER } });
  return new ProviderError(message, { provider: PROVIDER, details: { status } });
}
