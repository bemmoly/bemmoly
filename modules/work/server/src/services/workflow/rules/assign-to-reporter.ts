import { z } from 'zod';
import { actorUserId, type PostActionRule } from './types.ts';

const params = z.object({});

/** Hands a finished or reopened issue back to whoever asked for it. */
export const assignToReporter: PostActionRule<z.infer<typeof params>> = {
  name: 'assign_to_reporter',
  kind: 'post_action',
  label: 'Assign to reporter',
  description: 'Sets the assignee to the issue reporter',
  params,
  async run(_args, rule) {
    const { issue } = rule;
    if (issue.reporter_id === null || issue.assignee_id === issue.reporter_id) return;
    await rule.writes.setField(
      rule.sql,
      issue.id,
      actorUserId(rule),
      'assignee_id',
      issue.reporter_id,
    );
  },
};
