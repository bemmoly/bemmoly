import type { AiFacade, SqlClient } from '@bemmoly/core';
import { requireDatabase } from '../issues/deps.ts';
import { createAskReportsService } from './ask.ts';
import { createPinnedReportsService } from './pinned.ts';
import { projectVocabulary, readableProject, runReportSpec } from './run.ts';

export { ASK_REPORT_PROMPT, ASK_REPORT_PROMPT_FILE, ASK_REPORT_PURPOSE } from './ask.ts';
export type { AskReportsService } from './ask.ts';
export type { PinnedReportsService } from './pinned.ts';
export { computeReport, measure, type ReportIssue } from './compute.ts';

export interface AskReportsServicesDeps {
  database?: SqlClient;
  ai: AiFacade;
  now?: () => Date;
}

/** Asked reports (through AI) and pinned reports (no AI), over one spec runner. */
export function createAskReportsServices(deps: AskReportsServicesDeps) {
  const sql = () => requireDatabase(deps);
  const now = () => deps.now?.() ?? new Date();
  const ask = createAskReportsService({
    ai: deps.ai,
    now,
    backend: {
      project: (ctx, ref) => readableProject(sql(), ctx, ref),
      vocabulary: (projectId) => projectVocabulary(sql(), projectId),
      run: (ctx, projectId, spec) => runReportSpec(sql(), ctx, projectId, spec, now()),
    },
  });
  const pinned = createPinnedReportsService({
    ...(deps.database ? { database: deps.database } : {}),
    now,
  });
  return { ask, pinned };
}

export type AskReportsServices = ReturnType<typeof createAskReportsServices>;
