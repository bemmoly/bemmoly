import type { PdfRenderer } from '../contracts/pdf.ts';
import type { ModuleColor, ModuleSettingsInput, SidebarSectionInput } from '@bemmoly/shared';
import type { SqlClient } from '../clients/postgres.ts';
import type { AuditRecorder } from '../contracts/audit.ts';
import type { Actor } from '../contracts/authz.ts';
import type { Changelog } from '../contracts/changelog.ts';
import type { EventBus } from '../contracts/event-bus.ts';
import type { ContainerMemberships } from '../contracts/memberships.ts';
import type { RealtimePublisher } from '../contracts/realtime.ts';
import type { CodeRegistry } from './code.ts';
import type { RequestContext } from '../services/authz/index.ts';
import type { CollabRegistry } from './collab.ts';
import type { McpRegistry } from './mcp.ts';
import type { FilesRegistry } from './files.ts';
import type { ModuleObjects } from './objects.ts';
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

/**
 * Where people meet a module. "shell" puts it in Bemmoly's frame: sidebar, menus, ⌘K and
 * Home. "product" is a module behind a product with its own web app and front door
 * (Pipelines): the kernel loads its routes, capabilities and grants, and Bemmoly's shell never
 * draws it.
 */
export type ModuleSurface = 'shell' | 'product';

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
  /** "shell" when absent. */
  surface?: ModuleSurface;
  /** Its tile's icon in the sidebar, menus and Settings › Modules: an icon name. */
  icon?: string;
  /** Its tile's colour: a logo colour, the accent or an epic hue, never a hex. */
  color?: ModuleColor;
  /** Where its sidebar section and menu entries sit, lowest first. */
  order?: number;
  /** Its one section in the app sidebar; every path lives under /<id>. */
  sidebar?: SidebarSectionInput;
  /** Its own settings: one row under Settings › Modules, at a path under /settings/<id>. */
  settings?: ModuleSettingsInput;
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
  /** Resources, prompts and MCP-only tools for the built-in MCP server. */
  mcp: McpRegistry;
  /** Present only when an editor-owning module is enabled. */
  editor?: EditorRegistry;
  importers: ImporterRegistry;
  settings: SettingsRegistry;
  /** Collaborative documents served over /collab, and server-side edits to them. */
  collab: CollabRegistry;
  /** Targets people upload files into (a page); the kernel stores and serves the bytes. */
  files: FilesRegistry;
  /** Bytes the module owns (build logs, reports), under its own prefix in the object store. */
  objects: ModuleObjects;
  /** Consumers of verified code host activity (pull requests, branches, commits). */
  code: CodeRegistry;
  /** Invalidation messages for WebSocket clients; a no-op without a database. */
  realtime: RealtimePublisher;
  /** The kernel's Postgres pool for the module's own tables; absent without DATABASE_URL. */
  database?: SqlClient;
  /** Writes the kernel's audit log; present whenever the database is. */
  audit?: AuditRecorder;
  /** Project and space membership; present whenever the database is. */
  memberships?: ContainerMemberships;
  /**
   * The context a job acts in as an actor that is not a request: an automation rule, say.
   * Its `authz` is the one requests get, so a job's writes are checked the same way.
   */
  contextFor?: ActorContextFactory;
  /** The optional PDF renderer; absent unless BEMMOLY_PDF_URL names one. */
  pdf?: PdfRenderer;
  /** BEMMOLY_PUBLIC_URL: the server's own address, never the request's Host header. */
  publicUrl?: string;
}

export type ActorContextFactory = (
  actor: Actor,
  options?: { requestId?: string },
) => RequestContext;

/** Identity helper so a module manifest is checked against the contract. */
export function defineModule(module: BemmolyModule): BemmolyModule {
  return module;
}
