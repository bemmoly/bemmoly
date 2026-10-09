import type { SqlClient } from '../clients/postgres.ts';
import type { AuditRecorder } from '../contracts/audit.ts';
import type { Changelog } from '../contracts/changelog.ts';
import type { EventBus } from '../contracts/event-bus.ts';
import type { ContainerMemberships } from '../contracts/memberships.ts';
import type { RealtimePublisher } from '../contracts/realtime.ts';
import type { CollabRegistry } from './collab.ts';
import type {
  AiRegistry,
  CapabilityRegistry,
  EditorRegistry,
  EntityRegistry,
  ImporterRegistry,
  JobRegistry,
  LinkRegistry,
  NavRegistry,
  RouteRegistry,
  SearchRegistry,
  SettingsRegistry,
} from './registries.ts';

export type ModuleDefaultAccess = 'everyone' | 'teams' | 'none';

export interface BemmolyModule {
  /** Stable, lowercase, used in config, URLs and the changelog table. */
  id: 'work' | 'docs' | (string & {});
  /** What Settings › Modules calls it, e.g. "Work"; the id, capitalised, when absent. */
  name?: string;
  /** The app version it shipped in. */
  version: string;
  /** Semver range of the kernel API it was built against. */
  coreApi: string;
  /** Hard dependencies on other modules. */
  dependsOn?: readonly string[];
  /** Initial module_grants row when the module is enabled. */
  defaultAccess: ModuleDefaultAccess;
  /** This module's ordered changesets, tracked per module in schema_changelog. */
  changelog: Changelog;
  /** Everything the module provides is registered here, once, at boot. */
  register(ctx: ModuleContext): void;
}

export interface ModuleContext {
  routes: RouteRegistry;
  entities: EntityRegistry;
  links: LinkRegistry;
  capabilities: CapabilityRegistry;
  navigation: NavRegistry;
  jobs: JobRegistry;
  events: EventBus;
  search: SearchRegistry;
  ai: AiRegistry;
  /** Present only when an editor-owning module is enabled. */
  editor?: EditorRegistry;
  importers: ImporterRegistry;
  settings: SettingsRegistry;
  /** Collaborative documents served over /collab, and server-side edits to them. */
  collab: CollabRegistry;
  /** Invalidation messages for WebSocket clients; a no-op without a database. */
  realtime: RealtimePublisher;
  /** The kernel's Postgres pool for the module's own tables; absent without DATABASE_URL. */
  database?: SqlClient;
  /** Writes the kernel's audit log; present whenever the database is. */
  audit?: AuditRecorder;
  /** Project and space membership; present whenever the database is. */
  memberships?: ContainerMemberships;
}

/** Identity helper so a module manifest is checked against the contract. */
export function defineModule(module: BemmolyModule): BemmolyModule {
  return module;
}
