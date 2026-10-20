import { fileURLToPath } from 'node:url';
import { aiRefusal, type AiFacade, type RequestContext } from '@bemmoly/core';
import {
  reportSpecSchema,
  type AskReportBody,
  type AskReportResponse,
  type ReportResult,
  type ReportSpec,
} from '../../../../shared/ask-reports.ts';
import type { PlanningProject } from '../boards/context.ts';
import type { ProjectVocabulary } from './run.ts';

/*
 * A question in words becomes a report: the model fills in a report spec (a closed set of
 * metric, grouping, filters and chart, validated by the runtime against reportSpecSchema and
 * repaired once), and the server runs that spec with the asker's permissions. The model is
 * sent the question and the project's status and type names, never issue text, and nothing it
 * returns reaches the database except as a value the spec's schema allows.
 */

export const ASK_REPORT_PURPOSE = 'work.report_ask';
export const ASK_REPORT_PROMPT = 'work.report_spec';
export const ASK_REPORT_PROMPT_FILE = {
  name: ASK_REPORT_PROMPT,
  path: fileURLToPath(new URL('./prompts/report-spec.md', import.meta.url)),
} as const;

/** What the ask path needs from the database side; the module wires the real one. */
export interface AskReportsBackend {
  project(ctx: RequestContext, ref: string): Promise<PlanningProject>;
  vocabulary(projectId: string): Promise<ProjectVocabulary>;
  run(ctx: RequestContext, projectId: string, spec: ReportSpec): Promise<ReportResult>;
}

export interface AskReportsDeps {
  ai: AiFacade;
  backend: AskReportsBackend;
  now?: () => Date;
}

/** AI on for the person, their role allowed AI assist, and the project not excluded. */
async function gate(ai: AiFacade, ctx: RequestContext, projectId: string): Promise<void> {
  const policy = await ai.policy(ctx.actor);
  if (!policy.enabled) throw aiRefusal('ai_off');
  if (policy.actorOptedOut) throw aiRefusal('opted_out');
  await ctx.authz.authorize(ctx.actor, 'ai.assist.use', { kind: 'workspace' });
  if (!(await ai.maySend({ projectId }, ctx.actor))) throw aiRefusal('excluded');
}

const list = (names: readonly string[]) => (names.length ? names.join(', ') : 'none yet');

export function createAskReportsService(deps: AskReportsDeps) {
  const now = () => deps.now?.() ?? new Date();
  return {
    async ask(ctx: RequestContext, ref: string, body: AskReportBody): Promise<AskReportResponse> {
      const project = await deps.backend.project(ctx, ref);
      await gate(deps.ai, ctx, project.id);
      const vocabulary = await deps.backend.vocabulary(project.id);
      const prompt = await deps.ai.renderPrompt(ASK_REPORT_PROMPT, {
        project: `${vocabulary.name} (${project.key})`,
        statuses: list(vocabulary.statuses),
        types: list(vocabulary.types),
        today: now().toISOString().slice(0, 10),
        question: body.question,
      });
      const generated = await deps.ai.generate({
        role: prompt.role,
        purpose: ASK_REPORT_PURPOSE,
        actor: ctx.actor,
        system: prompt.system,
        prompt: prompt.prompt,
        promptRef: prompt.promptRef,
        schema: reportSpecSchema,
        temperature: 0,
        maxOutputTokens: 400,
        ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
      });
      // The runtime validated it already; parsing again keeps this path safe on its own.
      const spec = reportSpecSchema.parse(generated.object);
      const result = await deps.backend.run(ctx, project.id, spec);
      return { question: body.question, result, runId: generated.runId };
    },
  };
}

export type AskReportsService = ReturnType<typeof createAskReportsService>;
