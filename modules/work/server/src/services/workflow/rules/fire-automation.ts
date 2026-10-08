import { ProviderError } from '@bemmoly/shared';
import { z } from 'zod';
import { WORK_AUTOMATION_RUN_JOB } from '../../jobs.ts';
import type { PostActionRule } from './types.ts';

const params = z.object({
  ruleId: z.uuid(),
});

/**
 * Queues an automation rule for the engine of a later release. The job name
 * is fixed now so a workflow published today keeps working when the engine
 * arrives; until then the handler is a no-op the module registers.
 */
export const fireAutomation: PostActionRule<z.infer<typeof params>> = {
  name: 'fire_automation',
  kind: 'post_action',
  label: 'Fire automation',
  description: 'Runs an automation rule with the issue as input',
  params,
  available: (deps) => deps.jobs !== undefined,
  async run(args, rule) {
    if (!rule.jobs) throw new ProviderError('The work module needs the job queue');
    await rule.jobs.send(
      WORK_AUTOMATION_RUN_JOB,
      { ruleId: args.ruleId, issueId: rule.issue.id, toStatusId: rule.toStatus.id },
      rule.ctx.requestId ? { requestId: rule.ctx.requestId } : {},
    );
  },
};
