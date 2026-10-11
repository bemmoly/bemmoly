import {
  AUTOMATION_ACTIONS,
  assignArgsSchema,
  type AssignArgs,
} from '../../../../../shared/index.ts';
import type { ActionContext, ActionDefinition } from '../contract.ts';

function assigneeOf(args: AssignArgs, { issue, triggeredBy }: ActionContext): string | null {
  if (args.to === 'user') return args.userId ?? null;
  if (args.to === 'reporter') return issue.reporterId;
  if (args.to === 'trigger_actor') return triggeredBy;
  return null;
}

export const assign: ActionDefinition<AssignArgs> = {
  name: AUTOMATION_ACTIONS.assign,
  label: 'Assign',
  description: 'Assigns the issue to a person, its reporter or whoever triggered the rule',
  params: assignArgsSchema,
  async run(args, action) {
    const { ctx, issue, services } = action;
    const assigneeId = assigneeOf(args, action);
    if (args.to !== 'unassigned' && !assigneeId) return 'Nobody to assign: left as it was';
    if (assigneeId === issue.assigneeId) return 'Already assigned';
    await services.issues.assign(ctx, issue.key, assigneeId);
    return assigneeId ? 'Assigned the issue' : 'Unassigned the issue';
  },
};
