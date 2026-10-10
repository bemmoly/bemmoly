import {
  ANSWER_PROMPT_FILE,
  authenticateRequest,
  createAiService,
  createInsightsService,
  createSecretBox,
  INSIGHT_PROMPT_FILES,
  PLAN_PROMPT_FILE,
  wireAiPlans,
  type AiHandle,
  type AiPlans,
  type AiService,
  type InsightsService,
  type KernelRouteDependencies,
  type ModuleRegistry,
} from '@bemmoly/core';
import type { Env, Logger } from '@bemmoly/core/config';
import type { DatabaseConnection } from './database.ts';
import type { IdentityWiring } from './identity.ts';
import type { DataKernel } from './kernel.ts';
import { appVersionOf } from './version.ts';

export interface AiWiringInput {
  env: Pick<
    Env,
    'BEMMOLY_SECRET_KEY' | 'BEMMOLY_AI_RECORDING' | 'BEMMOLY_ALLOW_PRIVATE_URLS' | 'BEMMOLY_VERSION'
  >;
  database: DatabaseConnection;
  kernel: DataKernel;
  identity: IdentityWiring;
  /** Every registered module: prompt files, exclusion sources and plan tools. */
  modules: ModuleRegistry;
  /** Bound here, so ctx.ai and /me's aiEnabled start answering. */
  handle: AiHandle;
  logger: Logger;
}

export interface AiWiring {
  service: AiService;
  plans: AiPlans;
  insights: InsightsService;
  routes: Pick<KernelRouteDependencies, 'ai' | 'aiPlans' | 'insights'>;
}

/**
 * The AI runtime on the data kernel: prompts validated (boot fails on a bad file), the facade
 * bound into ctx.ai, the catalog refresh, plans and insights jobs registered before the jobs
 * service starts, and Settings › AI, plans and insights routes. With AI off every AI
 * endpoint and ctx.ai refuse; Settings › AI stays reachable to turn it on.
 */
export async function wireAi(input: AiWiringInput): Promise<AiWiring> {
  const { env, database, kernel, modules, handle, logger } = input;
  const isEnabled = (moduleId: string) => kernel.moduleState.isEnabled(moduleId);
  const service = createAiService({
    sql: database.sql,
    secrets: createSecretBox(env.BEMMOLY_SECRET_KEY),
    settings: kernel.settings,
    authorize: input.identity.authorize,
    events: kernel.events,
    realtime: kernel.realtime,
    appVersion: appVersionOf(env),
    kernelPromptFiles: [PLAN_PROMPT_FILE, ANSWER_PROMPT_FILE, ...INSIGHT_PROMPT_FILES],
    modulePromptFiles: modules
      .aiPromptFiles()
      .map((file) => ({ moduleId: file.moduleId, path: file.path })),
    exclusionSources: () =>
      modules
        .aiExclusionSources()
        .filter((source) => isEnabled(source.moduleId))
        .map((source) => ({ moduleId: source.moduleId, source })),
    ...(env.BEMMOLY_AI_RECORDING ? { recordingPath: env.BEMMOLY_AI_RECORDING } : {}),
    allowPrivateUrls: env.BEMMOLY_ALLOW_PRIVATE_URLS,
    logger: logger.child({ component: 'ai' }),
  });
  await service.load();
  if (env.BEMMOLY_AI_RECORDING) {
    logger.warn(
      { file: env.BEMMOLY_AI_RECORDING },
      'AI answers come from a recording; no provider is called',
    );
  }
  handle.bind(service.facade);
  service.registerJobs(kernel.jobs);
  const ai = () => handle.current();
  const plans = wireAiPlans({
    sql: database.sql,
    db: database.db,
    modules,
    isEnabled,
    jobs: kernel.jobs,
    realtime: kernel.realtime,
    ai,
    logger: logger.child({ component: 'ai-plans' }),
  });
  const insights = createInsightsService({
    ai: service.facade,
    database: database.sql,
    jobs: kernel.jobs,
    realtime: kernel.realtime,
    events: kernel.events,
    modules,
    isEnabled,
  });
  insights.start();
  return {
    service,
    plans,
    insights,
    routes: {
      ai: { authenticate: authenticateRequest, ai: service },
      aiPlans: plans,
      insights,
    },
  };
}
