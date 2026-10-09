import type { NavEntry } from '@bemmoly/shared';
import type { SettingDefinition } from '../contracts/settings.ts';
import type {
  AiContribution,
  CapabilityDefinition,
  EditorContribution,
  EntityDefinition,
  ImporterDefinition,
  JobDefinition,
  LinkKindDefinition,
  QueryFieldDefinition,
  RouteDefinition,
  SearchIndexerDefinition,
  SearchProviderDefinition,
} from './registries.ts';

/** Everything one module registered, kept in registration order. */
export interface ModuleContributions {
  routes: RouteDefinition[];
  entities: EntityDefinition[];
  links: LinkKindDefinition[];
  capabilities: CapabilityDefinition[];
  navigation: NavEntry[];
  jobs: JobDefinition[];
  searchIndexers: SearchIndexerDefinition[];
  searchProviders: SearchProviderDefinition[];
  queryFields: QueryFieldDefinition[];
  aiTools: AiContribution[];
  aiContextBuilders: AiContribution[];
  aiInsightGenerators: AiContribution[];
  aiPromptFiles: { name: string; path: string }[];
  editorNodes: EditorContribution[];
  editorSlashCommands: EditorContribution[];
  importers: ImporterDefinition[];
  settings: SettingDefinition[];
}

export function emptyContributions(): ModuleContributions {
  return {
    routes: [],
    entities: [],
    links: [],
    capabilities: [],
    navigation: [],
    jobs: [],
    searchIndexers: [],
    searchProviders: [],
    queryFields: [],
    aiTools: [],
    aiContextBuilders: [],
    aiInsightGenerators: [],
    aiPromptFiles: [],
    editorNodes: [],
    editorSlashCommands: [],
    importers: [],
    settings: [],
  };
}
