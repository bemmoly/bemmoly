import { z } from 'zod';

/**
 * What a WebSocket client can subscribe to. A board subscribes to its project,
 * a page to its space, the shell to `workspace` (settings, module changes).
 */
export const realtimeScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('workspace') }),
  z.object({ kind: z.literal('project'), id: z.string().min(1).max(64) }),
  z.object({ kind: z.literal('space'), id: z.string().min(1).max(64) }),
  z.object({ kind: z.literal('module'), id: z.string().min(1).max(64) }),
]);

/** The small invalidation message published with NOTIFY and forwarded to clients. */
export const realtimeMessageSchema = z.object({
  kind: z.string().min(1).max(128),
  ids: z.array(z.string().max(128)).max(200),
  projectId: z.string().max(64).optional(),
  spaceId: z.string().max(64).optional(),
  /** Addressed to one person: delivered to that user's sockets only. */
  userId: z.string().max(64).optional(),
  moduleId: z.string().max(64).optional(),
});

/**
 * Where someone is inside a scope: a view name with an optional subject, such
 * as `board`, `backlog` or `issue:PLT-204`. Never free text, since everyone
 * else in the scope sees it.
 */
export const presenceViewSchema = z
  .string()
  .max(80)
  .regex(/^[a-z][a-z0-9-]{0,14}(:[A-Za-z0-9._-]{1,64})?$/);

/** The most people one presence list carries; a facepile shows three and a count. */
export const PRESENCE_LIST_LIMIT = 50;

/** One person present in a scope: where they are, and since when. */
export const presenceEntrySchema = z.object({
  userId: z.string().min(1).max(64),
  view: presenceViewSchema,
  since: z.iso.datetime(),
});

export const realtimeClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribe'), scope: realtimeScopeSchema }),
  z.object({ type: z.literal('unsubscribe'), scope: realtimeScopeSchema }),
  z.object({ type: z.literal('ping') }),
  /** "I am here": joins a scope's presence, or moves within it. One place per socket. */
  z.object({ type: z.literal('presence'), scope: realtimeScopeSchema, view: presenceViewSchema }),
  /** Leaves whichever presence the socket joined. */
  z.object({ type: z.literal('leave') }),
]);

export const realtimeServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('pong') }),
  z.object({ type: z.literal('subscribed'), scope: realtimeScopeSchema }),
  z.object({ type: z.literal('unsubscribed'), scope: realtimeScopeSchema }),
  z.object({ type: z.literal('invalidate'), message: realtimeMessageSchema }),
  /** Everyone else present in the scope the socket joined, sent whenever that changes. */
  z.object({
    type: z.literal('presence'),
    scope: realtimeScopeSchema,
    people: z.array(presenceEntrySchema).max(PRESENCE_LIST_LIMIT),
  }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

export type RealtimeScope = z.infer<typeof realtimeScopeSchema>;
export type RealtimeMessagePayload = z.infer<typeof realtimeMessageSchema>;
export type RealtimeClientMessage = z.infer<typeof realtimeClientMessageSchema>;
export type RealtimeServerMessage = z.infer<typeof realtimeServerMessageSchema>;
export type PresenceEntry = z.infer<typeof presenceEntrySchema>;
