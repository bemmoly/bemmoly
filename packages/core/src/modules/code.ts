import type {
  CodeActivity,
  CodeEventOf,
  CodeHostClient,
  CodeHostRepository,
} from '../contracts/code-hosts.ts';
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

/**
 * A module that acts on host events (a push, a pull request, a check) instead of linking
 * them. Called in process, in the webhook request, after the delivery is verified and
 * claimed once: a consumer should store what it needs and return quickly.
 */
export interface CodeEventConsumer {
  /** Namespaced by module: "pipelines.inbox". */
  id: string;
  apply(events: readonly CodeEventOf[], ctx: RequestContext): Promise<CodeActivityResult>;
}

/**
 * Extra GitHub App permissions and events a module needs, merged into the app manifest the
 * kernel offers (write wins over read). Only the enabled modules' requests are offered.
 */
export interface CodeAppPermissions {
  permissions: Readonly<Record<string, 'read' | 'write'>>;
  events: readonly string[];
}

/** Finds the connected host that covers a repository; bound once code hosts are wired. */
export interface CodeHostDirectory {
  /** The client for the integration covering `repository`, or null when none does. */
  clientFor(repository: string): Promise<CodeHostClient | null>;
  /**
   * Every repository the enabled hosts let Bemmoly read, once each: a GitHub App's
   * installation asked live, other connections from the repositories named on them.
   */
  repositories(): Promise<CodeHostRepository[]>;
}

/** What a module sees as `ctx.code`. */
export interface CodeRegistry {
  addConsumer(consumer: CodeActivityConsumer): void;
  addEventConsumer(consumer: CodeEventConsumer): void;
  requestAppPermissions(request: CodeAppPermissions): void;
  /** The connected hosts, for reporting checks and deployments and reading files. */
  hosts(): CodeHostDirectory;
}
