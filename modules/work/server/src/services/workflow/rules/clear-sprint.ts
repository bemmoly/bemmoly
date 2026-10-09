import { z } from 'zod';
import { actorUserId, type PostActionRule } from './types.ts';

const params = z.object({});

/** An issue closed as "Won't do" leaves the sprint so it stops counting against capacity. */
export const clearSprint: PostActionRule<z.infer<typeof params>> = {
  name: 'clear_sprint',
  kind: 'post_action',
  label: 'Clear sprint',
  description: 'Removes the issue from its sprint',
  params,
  async run(_args, rule) {
    if (rule.issue.sprint_id === null) return;
    await rule.writes.setField(rule.sql, rule.issue.id, actorUserId(rule), 'sprint_id', null);
  },
};
