import { z } from 'zod';
import { fail, pass, type ConditionRule } from './types.ts';

const params = z.object({});

/** A parent cannot close while a child is open; "open" is any status not in the done category. */
export const subtasksDone: ConditionRule<z.infer<typeof params>> = {
  name: 'subtasks_done',
  kind: 'condition',
  label: 'Subtasks are done',
  description: 'Every subtask of the issue is in a done status',
  params,
  async check(_args, rule) {
    const open = await rule.reads.openSubtasks(rule.sql, rule.issue.id);
    return open === 0 ? pass : fail(`${open} subtask${open === 1 ? ' is' : 's are'} still open`);
  },
};
