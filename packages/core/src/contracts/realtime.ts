import type { SqlExecutor } from './sql.ts';

/** A tiny invalidation message; clients refetch through the REST API. */
export interface RealtimeMessage {
  kind: string;
  ids: readonly string[];
  projectId?: string;
  spaceId?: string;
  /** Delivered only to this user's sockets, e.g. their inbox. */
  userId?: string;
  /** Scope for module-level changes (enable, disable, module settings). */
  moduleId?: string;
}

export interface RealtimePublishOptions {
  /** Publish with the caller's transaction so subscribers hear of it only on commit. */
  transaction?: SqlExecutor;
}

export interface RealtimePublisher {
  publish(message: RealtimeMessage, options?: RealtimePublishOptions): Promise<void>;
}
