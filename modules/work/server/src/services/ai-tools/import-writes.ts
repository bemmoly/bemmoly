import { defineWriteTool } from '@bemmoly/core';
import {
  importIssuesBodySchema,
  ISSUE_IMPORT_MAX,
  type ImportIssuesBody,
} from '../../../../shared/issue-import.ts';
import type { WorkServices } from '../index.ts';

/*
 * Bringing a project over from another tracker. The batch is the import service's own body;
 * the result names what each external key became, so an agent can page through a source and
 * send links or follow-ups by key. A re-run updates, so a step interrupted mid-run is retried.
 */

export function importWriteTools(services: WorkServices) {
  const importIssues = defineWriteTool<ImportIssuesBody, null>({
    name: 'work_import_issues',
    kind: 'write',
    description:
      `Import up to ${ISSUE_IMPORT_MAX} issues from another tracker into a project, keeping ` +
      'their numbers when free, timestamps, people (by email) and comments. Each externalKey ' +
      '("TRP-12") is remembered: sending it again updates that issue. Types and statuses go ' +
      'by name. Returns created, updated and skipped keys. Needs workspace admin rights.',
    input: importIssuesBodySchema,
    idempotent: true,
    describe: async (_ctx, input) => ({
      target: input.projectKey,
      change: `Import ${input.issues.length} issue${input.issues.length === 1 ? '' : 's'}`,
      field: 'Import',
      from: null,
      to: null,
      href: null,
    }),
    authorize: async (ctx, input) => {
      await services.issueImport.authorize(ctx, input.projectKey);
    },
    run: async (ctx, input) => {
      const result = await services.issueImport.run(ctx, input);
      return { undo: null, result };
    },
  });

  return [importIssues];
}
