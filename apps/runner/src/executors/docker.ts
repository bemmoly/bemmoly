import type { ResolvedStep } from '@bemmoly/module-pipelines/shared';
import { NotFoundError, ProviderError } from '@bemmoly/shared';
import type { DockerEngine } from '../clients/docker-engine.ts';
import { LineSplitter, dim } from '../utils/lines.ts';
import { FrameDemuxer } from './frames.ts';
import {
  CANCELLED_EXIT_CODE,
  type StepExecutor,
  type StepResult,
  type StepRunOptions,
} from './types.ts';

/** The image a step runs in when the pipeline names none. */
export const DEFAULT_STEP_IMAGE = 'alpine:3.20';
const PULL_TIMEOUT_MS = 20 * 60_000;
/** A step may run as long as its job; the job's own timeout stops it before this does. */
const WAIT_TIMEOUT_MS = 24 * 60 * 60_000;
const LOG_DRAIN_MS = 5_000;
/** Lets a step reach a control plane on the runner's machine as host.docker.internal. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** A step as a container: pull if missing, create, start, follow logs, wait, remove. */
export class DockerExecutor implements StepExecutor {
  private containerId: string | undefined;
  private cancelled = false;

  private readonly engine: DockerEngine;

  constructor(engine: DockerEngine) {
    this.engine = engine;
  }

  async run(step: ResolvedStep, options: StepRunOptions): Promise<StepResult> {
    const image = step.image ?? DEFAULT_STEP_IMAGE;
    if (!step.image) options.onLine(dim(`No image named; running in ${DEFAULT_STEP_IMAGE}`));
    await this.ensureImage(image, options.onLine);
    if (this.cancelled) return { exitCode: CANCELLED_EXIT_CODE };

    const created = await this.engine.json<{ Id: string }>({
      method: 'POST',
      path: `/containers/create?name=${encodeURIComponent(containerName(options.label))}`,
      body: {
        Image: image,
        Cmd: ['sh', '-c', step.run ?? ''],
        Env: Object.entries(containerEnv(options.env)).map(([key, value]) => `${key}=${value}`),
        WorkingDir: '/workspace',
        Tty: false,
        Labels: { 'dev.bemmoly.runner': 'step' },
        HostConfig: {
          Binds: [`${options.workspace}:/workspace`],
          ExtraHosts: ['host.docker.internal:host-gateway'],
        },
      },
    });
    if (!created) throw new ProviderError('Docker created no container', { provider: 'docker' });
    this.containerId = created.Id;
    try {
      if (this.cancelled) return { exitCode: CANCELLED_EXIT_CODE };
      await this.engine.json({ method: 'POST', path: `/containers/${created.Id}/start` });
      const logs = this.followLogs(created.Id, options.onLine);
      const result = await this.engine.json<{ StatusCode: number }>({
        method: 'POST',
        path: `/containers/${created.Id}/wait`,
        timeoutMs: WAIT_TIMEOUT_MS,
      });
      // The log stream ends when the container does; the bound covers a daemon that never closes it.
      await Promise.race([logs, new Promise((resolve) => setTimeout(resolve, LOG_DRAIN_MS))]);
      return { exitCode: result?.StatusCode ?? 1 };
    } finally {
      this.containerId = undefined;
      await this.engine
        .json({ method: 'DELETE', path: `/containers/${created.Id}?force=true&v=true` })
        .catch(() => undefined);
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    const id = this.containerId;
    if (!id) return;
    await this.engine
      .json({ method: 'POST', path: `/containers/${id}/kill` })
      .catch(() => undefined);
  }

  private async ensureImage(image: string, onLine: (line: string) => void): Promise<void> {
    try {
      await this.engine.json({ method: 'GET', path: `/images/${image}/json` });
      return;
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
    onLine(dim(`Pulling ${image}`));
    const [fromImage, tag] = splitReference(image);
    const query = new URLSearchParams({ fromImage, ...(tag ? { tag } : {}) });
    const stream = await this.engine.stream({
      method: 'POST',
      path: `/images/create?${query.toString()}`,
      timeoutMs: PULL_TIMEOUT_MS,
    });
    let failure: string | undefined;
    const lines = new LineSplitter((line) => {
      try {
        const event = JSON.parse(line) as { error?: string };
        if (event.error) failure = event.error;
      } catch {
        // Progress lines only matter when they report an error.
      }
    });
    for await (const chunk of stream) lines.push(chunk as Buffer);
    lines.end();
    if (failure)
      throw new ProviderError(`Could not pull ${image}: ${failure}`, { provider: 'docker' });
  }

  private async followLogs(id: string, onLine: (line: string) => void): Promise<void> {
    const stream = await this.engine.stream({
      method: 'GET',
      path: `/containers/${id}/logs?follow=true&stdout=true&stderr=true`,
      timeoutMs: WAIT_TIMEOUT_MS,
    });
    // Each stream keeps its own partial line, so stdout and stderr never splice mid-line.
    const splitters = { stdout: new LineSplitter(onLine), stderr: new LineSplitter(onLine) };
    const demuxer = new FrameDemuxer((which, payload) => splitters[which].push(payload));
    try {
      for await (const chunk of stream) demuxer.push(chunk as Buffer);
    } catch {
      // A killed container can cut the stream; what arrived is already delivered.
    }
    splitters.stdout.end();
    splitters.stderr.end();
  }
}

/** `registry:5000/name:tag` → [`registry:5000/name`, `tag`]; digests stay whole. */
export function splitReference(image: string): [string, string | undefined] {
  if (image.includes('@')) return [image, undefined];
  const slash = image.lastIndexOf('/');
  const colon = image.lastIndexOf(':');
  if (colon > slash) return [image.slice(0, colon), image.slice(colon + 1)];
  return [image, 'latest'];
}

function containerName(label: string): string {
  const safe = label.replace(/[^A-Za-z0-9_.-]/g, '-');
  return `bemmoly-${safe}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A control plane on localhost is the runner's host, which a container reaches by another name. */
export function containerEnv(env: Record<string, string>): Record<string, string> {
  const api = env['BEMMOLY_API_URL'];
  if (!api) return env;
  try {
    const url = new URL(api);
    if (!LOCAL_HOSTS.has(url.hostname)) return env;
    url.hostname = 'host.docker.internal';
    return { ...env, BEMMOLY_API_URL: url.toString().replace(/\/$/, '') };
  } catch {
    return env;
  }
}
