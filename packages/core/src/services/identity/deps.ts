import { createDatabase, type Database } from '../../clients/drizzle.ts';
import type { SqlClient } from '../../clients/postgres.ts';
import type { EventBus } from '../../contracts/event-bus.ts';
import type { SettingsService } from '../../contracts/settings.ts';
import type { ModuleCatalog } from '../authz/index.ts';

declare module '../../contracts/settings.ts' {
  interface SettingsKeys {
    /** The URL people open, set by the setup wizard's first step. */
    'workspace.url': string;
  }
}

export interface IdentityDependencies {
  db: Database;
  /** The pool behind `db`; transactions that publish events run on it (see transaction.ts). */
  sql: SqlClient;
  events: EventBus;
  settings: SettingsService;
  modules: ModuleCatalog;
  /** BEMMOLY_PUBLIC_URL; links in emails (invitations, password resets) start here. */
  publicUrl: string;
  /** Injected so tests can move time; defaults to the wall clock. */
  now?: () => Date;
}

export function nowOf(deps: Pick<IdentityDependencies, 'now'>): Date {
  return deps.now ? deps.now() : new Date();
}

/** A link into the web app under the public URL, keeping any path the URL already has. */
export function appLink(publicUrl: string, path: string): string {
  const base = publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`;
  return new URL(path.replace(/^\/+/, ''), base).toString();
}

/**
 * Builds the identity dependencies the host passes to the routes and
 * middlewares. A host that already wraps its pool passes that `db` so there is
 * one Drizzle instance per pool.
 */
export function createIdentityDependencies(
  options: Omit<IdentityDependencies, 'db'> & { db?: Database },
): IdentityDependencies {
  return { ...options, db: options.db ?? createDatabase(options.sql) };
}
