import { AI_ROLES, type AiPrompt } from '@bemmoly/shared';
import type { AiFacade, AiPolicy } from '../../../contracts/ai.ts';
import type { AiRunRecord } from '../runtime/dependencies.ts';
import { createAiFacade } from '../runtime/facade.ts';
import { createPromptService, type ModulePromptFile } from '../prompts/service.ts';
import { createEvalModelSource, type EvalProvider } from './model-source.ts';

/** AI on, everything shared, every role available: evals judge the prompt, not the policy. */
const EVAL_POLICY: AiPolicy = {
  enabled: true,
  shareContent: true,
  redactEmails: false,
  redactNames: false,
  excludedSpaceIds: [],
  excludedProjectIds: [],
  allowActions: true,
  perUserOptOutAllowed: false,
  optedOutUserIds: [],
  actorOptedOut: false,
  budgetState: 'unlimited',
  assignedRoles: AI_ROLES,
  availableRoles: AI_ROLES,
};

export interface EvalPrompts {
  /** Kernel prompt files, as the server loads them. */
  kernelFiles: readonly string[];
  /** Module prompt files, as the modules register them. */
  moduleFiles: readonly ModulePromptFile[];
}

export interface EvalAi {
  facade: AiFacade;
  /** Every ai_runs row the facade would have written. */
  readonly runs: AiRunRecord[];
  /** How many times the facade asked for a model; a call that never reaches one is 0. */
  modelRequests(): number;
}

/** Loads and validates every prompt file the way boot does, overrides off. */
export async function loadEvalPrompts(prompts: EvalPrompts): Promise<AiPrompt[]> {
  const service = createPromptService({
    kernelFiles: prompts.kernelFiles,
    moduleFiles: prompts.moduleFiles,
  });
  await service.load();
  return service.list();
}

/**
 * The real facade (prompt rendering, structured-output repair, tool loop, run log) over the
 * eval's provider: a recording for CI, a live model for the nightly run. No database.
 */
export async function createEvalAi(prompts: EvalPrompts, provider: EvalProvider): Promise<EvalAi> {
  const service = createPromptService({
    kernelFiles: prompts.kernelFiles,
    moduleFiles: prompts.moduleFiles,
  });
  await service.load();
  const models = await createEvalModelSource(provider);
  const runs: AiRunRecord[] = [];
  const facade = createAiFacade({
    models,
    policy: { policy: async () => EVAL_POLICY },
    prompts: { render: (id, variables) => service.render(id, variables) },
    runs: {
      record: async (run) => {
        runs.push(run);
        return `00000000-0000-7000-8000-${String(runs.length).padStart(12, '0')}`;
      },
    },
    maxRetries: provider.mode === 'live' ? 2 : 0,
  });
  return { facade, runs, modelRequests: () => models.requests };
}
