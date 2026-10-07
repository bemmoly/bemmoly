import type { Changelog } from '../contracts/changelog.ts';
import type { EventBus } from '../contracts/event-bus.ts';
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
}

/** Identity helper so a module manifest is checked against the contract. */
export function defineModule(module: BemmolyModule): BemmolyModule {
  return module;
}
