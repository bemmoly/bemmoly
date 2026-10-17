import { z } from 'zod';
import { idSchema, isoDateTimeSchema, slugSchema } from './common.ts';
import { logAppendedSchema } from './logs.ts';
import { liveCounterSchema } from './overview.ts';

/*
 * Live updates (architecture §18): GET /api/v1/pipelines/streams?topics=live,map:commerce is
 * one server-sent events stream per tab. Writers NOTIFY on one channel; the server coalesces
 * to at most one message per topic per second and fans out. A NOTIFY payload stays small:
 * it names what changed and the client refetches anything large.
 */

export const PIPELINES_NOTIFY_CHANNEL = 'pipelines_events';
/** Postgres refuses NOTIFY payloads of 8000 bytes or more. */
export const NOTIFY_PAYLOAD_LIMIT = 7900;
export const MAX_TOPICS = 20;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SLUG = '[a-z0-9][a-z0-9-]{0,62}';
const SCOPE = `(${SLUG}(/${SLUG})?)?`;

/** live · capacity · for-you · map:<scope> · run:<id> · job:<id>:log · application:<key>. */
export const TOPIC_PATTERN = new RegExp(
  `^(live|capacity|for-you|map:${SCOPE}|run:${UUID}|job:${UUID}:log|application:${SLUG})$`,
);

export const topicSchema = z.string().regex(TOPIC_PATTERN, 'Not a Pipelines stream topic');

export type ParsedTopic =
  | { kind: 'live' }
  | { kind: 'capacity' }
  | { kind: 'for-you' }
  | { kind: 'map'; scope: string }
  | { kind: 'run'; runId: string }
  | { kind: 'job-log'; jobId: string }
  | { kind: 'application'; key: string };

/** Reads a topic into its parts, or null when it is not one. */
export function parseTopic(topic: string): ParsedTopic | null {
  if (!TOPIC_PATTERN.test(topic)) return null;
  if (topic === 'live' || topic === 'capacity' || topic === 'for-you') return { kind: topic };
  const [head = '', id = ''] = topic.split(':');
  if (head === 'map') return { kind: 'map', scope: topic.slice('map:'.length) };
  if (head === 'run') return { kind: 'run', runId: id };
  if (head === 'job') return { kind: 'job-log', jobId: id };
  return { kind: 'application', key: id };
}

/** Builders, so no caller spells a topic by hand. */
export const topicOf = {
  live: () => 'live',
  capacity: () => 'capacity',
  forYou: () => 'for-you',
  map: (scope = '') => `map:${scope}`,
  run: (runId: string) => `run:${runId}`,
  jobLog: (jobId: string) => `job:${jobId}:log`,
  application: (key: string) => `application:${key}`,
} as const;

export const streamsQuerySchema = z.object({
  topics: z
    .union([z.string(), z.array(z.string())])
    .transform((value) =>
      [...new Set((Array.isArray(value) ? value : value.split(',')).map((t) => t.trim()))].filter(
        Boolean,
      ),
    )
    .pipe(z.array(topicSchema).min(1).max(MAX_TOPICS)),
});

const changed = z.object({ id: idSchema });

export const streamEventDataSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('counter'), data: liveCounterSchema }),
  z.object({
    kind: z.literal('run.updated'),
    data: changed.extend({ state: z.string(), number: z.number().int().optional() }),
  }),
  z.object({
    kind: z.literal('job.updated'),
    data: changed.extend({ runId: idSchema, state: z.string() }),
  }),
  z.object({ kind: z.literal('log.appended'), data: logAppendedSchema }),
  z.object({
    kind: z.literal('map.cell'),
    data: z.object({
      cells: z.array(z.object({ row: slugSchema, column: z.string() })).max(200),
    }),
  }),
  z.object({
    kind: z.literal('current.updated'),
    data: z.object({ application: slugSchema, environment: slugSchema, state: z.string() }),
  }),
  z.object({
    kind: z.literal('promotion.updated'),
    data: changed.extend({ state: z.string() }),
  }),
  z.object({
    kind: z.literal('deployment.updated'),
    data: changed.extend({ state: z.string(), trafficPercent: z.number().int().optional() }),
  }),
  z.object({ kind: z.literal('for-you.changed'), data: z.object({}).passthrough() }),
  z.object({ kind: z.literal('capacity.updated'), data: z.object({}).passthrough() }),
  z.object({ kind: z.literal('heartbeat'), data: z.object({}) }),
  z.object({
    kind: z.literal('catalog.updated'),
    data: z.object({ applications: z.array(slugSchema).max(100) }),
  }),
]);

/** What each SSE `data:` line carries. */
export const streamEventSchema = z.intersection(
  z.object({ topic: z.string(), at: isoDateTimeSchema }),
  streamEventDataSchema,
);

export const streamEventKindSchema = z.enum([
  'counter',
  'run.updated',
  'job.updated',
  'log.appended',
  'map.cell',
  'current.updated',
  'promotion.updated',
  'deployment.updated',
  'for-you.changed',
  'capacity.updated',
  'heartbeat',
  'catalog.updated',
]);

/**
 * What writers NOTIFY. `userId` narrows a per-person topic (for-you) to its person; `data`
 * is optional and small, and the coalescer keeps only the latest per topic each second.
 */
export const notifyPayloadSchema = z.object({
  topic: topicSchema,
  kind: streamEventKindSchema,
  userId: idSchema.optional(),
  data: z.unknown().optional(),
});

export type Topic = z.infer<typeof topicSchema>;
export type StreamsQuery = z.infer<typeof streamsQuerySchema>;
export type StreamEventData = z.infer<typeof streamEventDataSchema>;
export type StreamEvent = z.infer<typeof streamEventSchema>;
export type StreamEventKind = z.infer<typeof streamEventKindSchema>;
export type NotifyPayload = z.infer<typeof notifyPayloadSchema>;
