import { z } from 'zod';
import { actorUserId, type PostActionRule } from './types.ts';

const params = z.object({
  /** False clears resolved_at, for a transition that reopens an issue. */
  resolved: z.boolean().default(true),
});

/** Stamps or clears resolved_at, which cycle time and the Done column read. */
export const setResolution: PostActionRule<z.infer<typeof params>> = {
  name: 'set_resolution',
  kind: 'post_action',
  label: 'Set resolution',
  description: 'Marks the issue resolved now, or clears its resolution',
  params,
  async run(args, rule) {
    const isResolved = rule.issue.resolved_at !== null;
    if (isResolved === args.resolved) return;
    await rule.writes.setField(
      rule.sql,
      rule.issue.id,
      actorUserId(rule),
      'resolved_at',
      args.resolved ? new Date().toISOString() : null,
    );
  },
};
