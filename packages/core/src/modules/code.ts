import type { CodeActivity } from '../contracts/code-hosts.ts';
import type { RequestContext } from '../services/authz/index.ts';

/** What a consumer did with one delivery's activities, for the delivery log. */
export interface CodeActivityResult {
  /** Links written, updated or removed. */
  linked: number;
  /** What could not follow from it, in plain words (an issue the workflow would not move). */
  notes?: readonly string[];
}

/**
 * A module that turns code host activity into its own links: Work matches issue keys and
 * writes code links. The kernel verifies and normalises the delivery, then calls every
 * enabled module's consumer in process with a system context.
 */
export interface CodeActivityConsumer {
  /** Namespaced by module: "work.code-links". */
  id: string;
  apply(activities: readonly CodeActivity[], ctx: RequestContext): Promise<CodeActivityResult>;
}

/** What a module sees as `ctx.code`. */
export interface CodeRegistry {
  addConsumer(consumer: CodeActivityConsumer): void;
}
