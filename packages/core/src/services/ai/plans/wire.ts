import { fileURLToPath } from 'node:url';
import type { Logger } from 'pino';
import { z } from 'zod';
import type { Database } from '../../../clients/drizzle.ts';
import type { SqlClient } from '../../../clients/postgres.ts';
import type { AiFacade } from '../../../contracts/ai.ts';
import type { JobQueue } from '../../../contracts/jobs.ts';
import type { RealtimePublisher } from '../../../contracts/realtime.ts';
import type { FromModule } from '../../../modules/registry.ts';
import type { AiContribution } from '../../../modules/registries.ts';
import { createAuditRecorder } from '../../audit/index.ts';
import { createRequestAuthorization, type ModuleCatalog } from '../../authz/index.ts';
import { createAiToolRegistry, type AiToolRegistry } from '../tools/registry.ts';
import { AI_PLAN_RUN_JOB, createAiPlansService, type AiPlansService } from './service.ts';

/** The palette's prompt, loaded with the kernel prompts (id `ai.plan`). */
export const PLAN_PROMPT_FILE = fileURLToPath(new URL('./plan.prompt.md', import.meta.url));

export interface AiPlansWiring {
  sql: SqlClient;
  db: Database;
  /** The module registry: its capabilities for authorization and its tools. */
  modules: ModuleCatalog & { aiTools(): FromModule<AiContribution>[] };
  /** Live enabled state; a disabled module's tools are not offered. */
  isEnabled?: (moduleId: string) => boolean;
  jobs: JobQueue;
  realtime: RealtimePublisher;
  ai: () => AiFacade;
  logger?: Pick<Logger, 'warn' | 'error'>;
}

export interface AiPlans {
  service: AiPlansService;
  tools: AiToolRegistry;
}

const payloadSchema = z.object({ planId: z.uuid() });

/** Builds the plans service, registers its run job, and returns what the routes mount. */
export function wireAiPlans(wiring: AiPlansWiring): AiPlans {
  const tools = createAiToolRegistry({
    contributions: () => wiring.modules.aiTools(),
    ...(wiring.isEnabled ? { isEnabled: wiring.isEnabled } : {}),
  });
  const service = createAiPlansService({
    sql: wiring.sql,
    ai: wiring.ai,
    tools,
    jobs: wiring.jobs,
    realtime: wiring.realtime,
    audit: createAuditRecorder(wiring.sql),
    contextFor: (actor) => ({
      actor,
      authz: createRequestAuthorization({ db: wiring.db, modules: wiring.modules }),
    }),
    ...(wiring.logger ? { logger: wiring.logger } : {}),
  });
  wiring.jobs.register(
    AI_PLAN_RUN_JOB,
    async (payload) => service.execute(payloadSchema.parse(payload).planId),
    // Steps are claimed one by one, so a retry resumes where the last delivery stopped.
    { retryLimit: 2, retryDelaySeconds: 5 },
  );
  return { service, tools };
}
