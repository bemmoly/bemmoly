import type { NavEntry } from '@bemmoly/shared';
import type { RetrievalSourceDefinition } from '../contracts/retrieval.ts';
import type { SettingDefinition } from '../contracts/settings.ts';
import type { CodeActivityConsumer, CodeAppPermissions, CodeEventConsumer } from './code.ts';
import type { CollabDocumentDefinition } from './collab.ts';
import type { McpPromptDefinition, McpResourceDefinition } from './mcp.ts';
import type { FileTargetDefinition } from './files.ts';
import type { StartSourceDefinition } from './start.ts';
import type {
  AiContribution,
  AiExclusionSourceDefinition,
  CapabilityDefinition,
  EditorContribution,
  EntityDefinition,
  ImporterDefinition,
  JobDefinition,
  LinkKindDefinition,
  QueryFieldDefinition,
  ReferenceSourceDefinition,
  RouteDefinition,
  SearchIndexerDefinition,
  SearchProviderDefinition,
} from './registries.ts';

/** Everything one module registered, kept in registration order. */
export interface ModuleContributions {
  routes: RouteDefinition[];
  entities: EntityDefinition[];
  links: LinkKindDefinition[];
  referenceSources: ReferenceSourceDefinition[];
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
  aiExclusionSources: AiExclusionSourceDefinition[];
  retrievalSources: RetrievalSourceDefinition[];
  editorNodes: EditorContribution[];
  editorSlashCommands: EditorContribution[];
  importers: ImporterDefinition[];
  settings: SettingDefinition[];
  collabDocuments: CollabDocumentDefinition[];
  mcpResources: McpResourceDefinition[];
  mcpPrompts: McpPromptDefinition[];
  mcpTools: AiContribution[];
  fileTargets: FileTargetDefinition[];
  codeConsumers: CodeActivityConsumer[];
  codeEventConsumers: CodeEventConsumer[];
  codeAppPermissions: CodeAppPermissions[];
  startSources: StartSourceDefinition[];
}

export function emptyContributions(): ModuleContributions {
  return {
    routes: [],
    entities: [],
    links: [],
    referenceSources: [],
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
    aiExclusionSources: [],
    retrievalSources: [],
    editorNodes: [],
    editorSlashCommands: [],
    importers: [],
    settings: [],
    collabDocuments: [],
    mcpResources: [],
    mcpPrompts: [],
    mcpTools: [],
    fileTargets: [],
    codeConsumers: [],
    codeEventConsumers: [],
    codeAppPermissions: [],
    startSources: [],
  };
}
