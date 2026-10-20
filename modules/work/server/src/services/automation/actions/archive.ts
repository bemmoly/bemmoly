import {
  archiveArgsSchema,
  AUTOMATION_ACTIONS,
  type ArchiveArgs,
} from '../../../../../shared/index.ts';
import type { ActionDefinition } from '../contract.ts';

/** Puts the issue away; actions after it in the rule still run on it. */
export const archive: ActionDefinition<ArchiveArgs> = {
  name: AUTOMATION_ACTIONS.archive,
  label: 'Archive',
  description: 'Archives the issue: off the board and lists, kept and still open by its key',
  params: archiveArgsSchema,
  async run(_args, { ctx, issue, services }) {
    if (issue.archivedAt) return 'Already archived';
    await services.issues.archive(ctx, issue.key);
    return 'Archived the issue';
  },
};
