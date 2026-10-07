/**
 * In-memory stand-ins for kernel contracts other streams implement (settings,
 * job queue, realtime, users, authorization). Test-only; not exported.
 */
import { ForbiddenError } from '@bemmoly/shared';
import { pino } from 'pino';
import type { Actor, Authorize } from '../contracts/authz.ts';
import type { EnqueueOptions, JobQueue, QueuedJobHandler } from '../contracts/jobs.ts';
import type { RealtimeMessage, RealtimePublisher } from '../contracts/realtime.ts';
import type { SettingKey, SettingsKeys, SettingsService } from '../contracts/settings.ts';
import type { DirectoryUser, UserDirectory } from '../contracts/users.ts';
import { EMAIL_SETTING_DEFINITIONS } from '../services/email/index.ts';

export const silentLogger = pino({ level: 'silent' });

export interface FakeSettings extends SettingsService {
  values: Map<string, unknown>;
  put(key: string, value: unknown): void;
}

export function fakeSettings(initial: Record<string, unknown> = {}): FakeSettings {
  const values = new Map<string, unknown>(
    EMAIL_SETTING_DEFINITIONS.map((definition) => [definition.key, definition.default]),
  );
  values.set('workspace.name', 'Acme Labs');
  for (const [key, value] of Object.entries(initial)) values.set(key, value);
  return {
    values,
    put: (key, value) => values.set(key, value),
    async get<Key extends SettingKey>(key: Key) {
      return values.get(key) as SettingsKeys[Key];
    },
    async set(key, value) {
      values.set(key, value);
    },
  };
}

export interface QueuedJob {
  id: string;
  name: string;
  payload: object;
  options: EnqueueOptions;
}

export interface FakeJobQueue extends JobQueue {
  queued: QueuedJob[];
  handlers: Map<string, QueuedJobHandler>;
  /** Runs and removes every queued job of `name`, ignoring startAfter. */
  runAll(name: string): Promise<number>;
}

/** Singleton keys collapse while a job with the same key waits, as with pg-boss. */
export function fakeJobQueue(): FakeJobQueue {
  const queued: QueuedJob[] = [];
  const handlers = new Map<string, QueuedJobHandler>();
  let counter = 0;
  return {
    queued,
    handlers,
    register(name, handler) {
      handlers.set(name, handler as QueuedJobHandler);
    },
    async enqueue(name, payload, options = {}) {
      if (options.singleton && options.key) {
        if (queued.some((job) => job.name === name && job.options.key === options.key)) return null;
      }
      counter += 1;
      const job = { id: `job-${counter}`, name, payload, options };
      queued.push(job);
      return job.id;
    },
    async runAll(name) {
      const handler = handlers.get(name);
      if (!handler) throw new Error(`No handler for ${name}`);
      const jobs = queued.filter((job) => job.name === name);
      for (const job of jobs) queued.splice(queued.indexOf(job), 1);
      for (const job of jobs) {
        await handler(job.payload, { jobId: job.id, signal: new AbortController().signal });
      }
      return jobs.length;
    },
  };
}

export interface FakeRealtime extends RealtimePublisher {
  messages: RealtimeMessage[];
}

export function fakeRealtime(): FakeRealtime {
  const messages: RealtimeMessage[] = [];
  return {
    messages,
    async publish(message) {
      messages.push(message);
    },
  };
}

export function fakeDirectory(users: DirectoryUser[]): UserDirectory & { users: DirectoryUser[] } {
  return {
    users,
    async findByIds(ids) {
      return users.filter((user) => ids.includes(user.id));
    },
  };
}

/** Allows everything for user ids in `admins`, refuses everyone else. */
export function fakeAuthorize(admins: readonly string[]): Authorize {
  return async (actor: Actor) => {
    if (!admins.includes(actor.userId ?? actor.id)) throw new ForbiddenError();
  };
}

export const userActor = (id: string): Actor => ({ kind: 'user', id, userId: id });

export const TEST_SECRET_KEY = Buffer.alloc(32, 9).toString('base64');
