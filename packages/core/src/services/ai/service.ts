import { createModelServerClient } from '../../clients/model-server.ts';
import { createModelsDevClient, type ModelsDevClient } from '../../clients/models-dev.ts';
import type { Logger } from '../../config/logger.ts';
import type { AiFacade } from '../../contracts/ai.ts';
import type { ClusterEventBus, EventBus } from '../../contracts/event-bus.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import type { RealtimePublisher } from '../../contracts/realtime.ts';
import type { SettingsService } from '../../contracts/settings.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import type { AiExclusionSourceDefinition } from '../../modules/registries.ts';
import type { SecretBox } from '../settings/index.ts';
import { AI_SETTINGS_CHANGED, type AiServiceContext } from './admin/context.ts';
import { registerCatalogRefresh } from './catalog/refresh.ts';
import { createCatalogResolver } from './catalog/resolver.ts';
import { createPolicySource } from './policy.ts';
import { createPromptService, type ModulePromptFile } from './prompts/service.ts';
import { createAiFacade } from './runtime/facade.ts';
import { createDbModelSource } from './runtime/model-source.ts';
import { createRecordedModelSource, readRecording } from './runtime/recorded.ts';
import { watchBudget } from './budget-watch.ts';
import { personNames } from './store/preferences.ts';
import { insertRun } from './store/runs.ts';

export interface AiServiceDependencies {
  sql: SqlExecutor;
  secrets: SecretBox;
  settings: SettingsService;
  authorize: AiServiceContext['authorize'];
  events?: EventBus | ClusterEventBus;
  realtime?: RealtimePublisher;
  appVersion: string;
  /** Kernel prompt files (absolute paths) and the ones modules registered. */
  kernelPromptFiles?: readonly string[];
  modulePromptFiles?: readonly ModulePromptFile[];
  exclusionSources?: AiServiceContext['exclusionSources'];
  /** BEMMOLY_AI_RECORDING: a JSON file of canned replies; no provider is ever called. */
  recordingPath?: string;
  allowPrivateUrls?: boolean;
  logger?: Logger;
  /** Tests point the catalog at a fake models.dev. */
  modelsDev?: ModelsDevClient;
}

export interface AiService {
  facade: AiFacade;
  context: AiServiceContext;
  /** Validates prompt files; boot fails on a bad one. */
  load(): Promise<void>;
  /** The daily catalog refresh; call before the jobs service starts. */
  registerJobs(jobs: JobQueue): void;
}

const noExclusions = (): readonly { moduleId: string; source: AiExclusionSourceDefinition }[] => [];

export function createAiService(deps: AiServiceDependencies): AiService {
  const recording = deps.recordingPath ? readRecording(deps.recordingPath) : null;
  const catalog = createCatalogResolver({
    sql: deps.sql,
    client: deps.modelsDev ?? createModelsDevClient(),
    liveEnabled: async () => !recording && (await deps.settings.get('ai.liveCatalog')),
    appVersion: deps.appVersion,
    ...(deps.logger ? { logger: deps.logger } : {}),
  });
  const prompts = createPromptService({
    sql: deps.sql,
    kernelFiles: deps.kernelPromptFiles ?? [],
    moduleFiles: deps.modulePromptFiles ?? [],
  });
  const policy = createPolicySource({
    sql: deps.sql,
    settings: deps.settings,
    allRolesAssigned: recording !== null,
  });
  const models = recording
    ? createRecordedModelSource(recording)
    : createDbModelSource({
        sql: deps.sql,
        secrets: deps.secrets,
        catalog: () => catalog.cached(),
      });
  const context: AiServiceContext = {
    sql: deps.sql,
    secrets: deps.secrets,
    settings: deps.settings,
    authorize: deps.authorize,
    catalog,
    models,
    policy,
    prompts,
    modelServer: createModelServerClient(),
    ...(deps.events ? { events: deps.events } : {}),
    ...(deps.realtime ? { realtime: deps.realtime } : {}),
    exclusionSources: deps.exclusionSources ?? noExclusions,
    allowPrivateUrls: deps.allowPrivateUrls ?? false,
    recorded: recording !== null,
    testTimeoutMs: 10_000,
  };
  const budget = watchBudget(context);
  const facade = createAiFacade({
    models,
    policy,
    prompts,
    names: { names: () => personNames(deps.sql) },
    runs: {
      async record(run) {
        const id = await insertRun(deps.sql, run);
        if (run.costUsd > 0) budget.check();
        return id;
      },
    },
  });
  // Another replica changed roles, providers or settings: drop this one's caches too.
  const bus = deps.events as Partial<ClusterEventBus> | undefined;
  bus?.subscribeEverywhere?.(AI_SETTINGS_CHANGED, () => {
    policy.invalidate();
    models.invalidate();
  });
  return {
    facade,
    context,
    load: () => prompts.load(),
    registerJobs(jobs) {
      registerCatalogRefresh(jobs, {
        sql: deps.sql,
        catalog,
        aiEnabled: () => deps.settings.get('ai.enabled'),
      });
    },
  };
}
