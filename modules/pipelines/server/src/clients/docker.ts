import { request } from 'node:http';
import { z } from 'zod';

/*
 * A small Docker Engine API client for the local provider: just the calls it needs, over the
 * daemon's unix socket (Docker Desktop, Colima) or tcp, each with a hard timeout. Responses
 * are parsed with zod so the Engine's shapes stop here.
 */

export interface DockerClientOptions {
  /** "unix:///Users/me/.colima/default/docker.sock" or "tcp://127.0.0.1:2375". */
  host: string;
  timeoutMs?: number;
}

export class DockerError extends Error {
  override readonly name = 'DockerError';
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.status = status;
  }
}

const API = '/v1.43';

const containerSchema = z.object({
  Id: z.string(),
  Names: z.array(z.string()),
  Labels: z.record(z.string(), z.string()).default({}),
  State: z.string(),
  Created: z.number(),
});

const inspectSchema = z.object({
  Id: z.string(),
  Name: z.string(),
  State: z.object({ Running: z.boolean(), Status: z.string() }),
  NetworkSettings: z.object({
    Ports: z
      .record(
        z.string(),
        z.array(z.object({ HostIp: z.string(), HostPort: z.string() })).nullable(),
      )
      .nullable()
      .default({}),
  }),
});

export type DockerContainer = z.infer<typeof containerSchema>;
export type DockerInspect = z.infer<typeof inspectSchema>;

export interface CreateContainer {
  name: string;
  image: string;
  cmd?: string[];
  env?: Record<string, string>;
  labels: Record<string, string>;
  network: string;
  /** Container ports published on 127.0.0.1 at a port the daemon picks. */
  publish?: number[];
}

export function createDockerClient(options: DockerClientOptions) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const target = options.host.startsWith('unix://')
    ? { socketPath: options.host.slice('unix://'.length) }
    : (() => {
        const url = new URL(options.host.replace(/^tcp:/, 'http:'));
        return { host: url.hostname, port: Number(url.port || 2375) };
      })();

  function call(method: string, path: string, body?: unknown, wait = timeoutMs) {
    return new Promise<{ status: number; text: string }>((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = request(
        {
          ...target,
          method,
          path: `${API}${path}`,
          headers: payload
            ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
            : {},
          timeout: wait,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () =>
            resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }),
          );
          res.on('error', reject);
        },
      );
      req.on('timeout', () =>
        req.destroy(new DockerError(`Docker did not answer ${method} ${path} in time`, null)),
      );
      req.on('error', (error) =>
        reject(
          error instanceof DockerError
            ? error
            : new DockerError(`Docker is not reachable at ${options.host}: ${error.message}`, null),
        ),
      );
      if (payload) req.write(payload);
      req.end();
    });
  }

  async function json<T>(
    method: string,
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<T> {
    const { status, text } = await call(method, path, body);
    if (status >= 300)
      throw new DockerError(
        `Docker answered ${status} to ${method} ${path}: ${text.slice(0, 300)}`,
        status,
      );
    return schema.parse(JSON.parse(text));
  }

  async function ok(
    method: string,
    path: string,
    body?: unknown,
    allow: number[] = [],
  ): Promise<void> {
    const { status, text } = await call(method, path, body);
    if (status >= 300 && !allow.includes(status)) {
      throw new DockerError(
        `Docker answered ${status} to ${method} ${path}: ${text.slice(0, 300)}`,
        status,
      );
    }
  }

  return {
    async ping(): Promise<boolean> {
      const { status } = await call('GET', '/_ping');
      return status === 200;
    },

    async hasImage(image: string): Promise<boolean> {
      const { status } = await call('GET', `/images/${encodeURIComponent(image)}/json`);
      return status === 200;
    },

    /** Pulls an image; the daemon streams progress, which ends when the pull does. */
    async pull(image: string): Promise<void> {
      // "repo@sha256:…" is pulled by digest; "repo:tag" by tag; a bare name is :latest.
      const at = image.lastIndexOf(':');
      const query = image.includes('@')
        ? `fromImage=${encodeURIComponent(image)}`
        : at > image.lastIndexOf('/')
          ? `fromImage=${encodeURIComponent(image.slice(0, at))}&tag=${encodeURIComponent(image.slice(at + 1))}`
          : `fromImage=${encodeURIComponent(image)}&tag=latest`;
      const { status, text } = await call(
        'POST',
        `/images/create?${query}`,
        undefined,
        10 * 60_000,
      );
      if (status >= 300 || text.includes('"error"')) {
        throw new DockerError(`Could not pull ${image}: ${text.slice(-300)}`, status);
      }
    },

    async ensureNetwork(name: string, labels: Record<string, string>): Promise<void> {
      const { status } = await call('GET', `/networks/${encodeURIComponent(name)}`);
      if (status === 200) return;
      await ok(
        'POST',
        '/networks/create',
        { Name: name, Driver: 'bridge', Labels: labels, CheckDuplicate: true },
        [409],
      );
    },

    async list(labels: Record<string, string>): Promise<DockerContainer[]> {
      const filters = encodeURIComponent(
        JSON.stringify({ label: Object.entries(labels).map(([k, v]) => `${k}=${v}`) }),
      );
      return json('GET', `/containers/json?all=true&filters=${filters}`, z.array(containerSchema));
    },

    async inspect(name: string): Promise<DockerInspect | null> {
      const { status, text } = await call('GET', `/containers/${encodeURIComponent(name)}/json`);
      if (status === 404) return null;
      if (status >= 300)
        throw new DockerError(`Docker answered ${status} inspecting ${name}`, status);
      return inspectSchema.parse(JSON.parse(text));
    },

    async create(spec: CreateContainer): Promise<string> {
      const ports = spec.publish ?? [];
      const created = await json(
        'POST',
        `/containers/create?name=${encodeURIComponent(spec.name)}`,
        z.object({ Id: z.string() }),
        {
          Image: spec.image,
          Cmd: spec.cmd,
          Env: Object.entries(spec.env ?? {}).map(([k, v]) => `${k}=${v}`),
          Labels: spec.labels,
          ExposedPorts: Object.fromEntries(ports.map((port) => [`${port}/tcp`, {}])),
          HostConfig: {
            NetworkMode: spec.network,
            RestartPolicy: { Name: 'unless-stopped' },
            PortBindings: Object.fromEntries(
              ports.map((port) => [`${port}/tcp`, [{ HostIp: '127.0.0.1', HostPort: '' }]]),
            ),
          },
        },
      );
      return created.Id;
    },

    start: (name: string) =>
      ok('POST', `/containers/${encodeURIComponent(name)}/start`, undefined, [304]),

    remove: (name: string) =>
      ok('DELETE', `/containers/${encodeURIComponent(name)}?force=true`, undefined, [404]),
  };
}

export type DockerClient = ReturnType<typeof createDockerClient>;

/** The host port Docker published for a container port, once it is running. */
export function publishedPort(inspect: DockerInspect, port: number): number | null {
  const binding = inspect.NetworkSettings.Ports?.[`${port}/tcp`]?.[0];
  return binding ? Number(binding.HostPort) : null;
}
