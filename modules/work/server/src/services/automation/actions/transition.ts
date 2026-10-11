import { ValidationError } from '@bemmoly/shared';
import {
  AUTOMATION_ACTIONS,
  transitionArgsSchema,
  type TransitionArgs,
} from '../../../../../shared/index.ts';
import type { ActionDefinition } from '../contract.ts';

/**
 * Moves the issue through its own workflow, by the target status's name, so the same rule
 * works in every project. The workflow's conditions and validators apply as they would to a
 * person: a transition the workflow does not offer is an error in the run log.
 */
export const transition: ActionDefinition<TransitionArgs> = {
  name: AUTOMATION_ACTIONS.transition,
  label: 'Transition',
  description: 'Moves the issue to a status, by name, through its workflow',
  params: transitionArgsSchema,
  async run(args, { ctx, issue, services }) {
    const wanted = args.status.toLowerCase();
    const options = await services.workflow.issueTransitions(ctx, issue.key);
    const move = options.find((option) => option.toStatusName.toLowerCase() === wanted);
    if (!move) throw new ValidationError(`${issue.key} has no transition to ${args.status}`);
    if (!move.available) {
      throw new ValidationError(
        `${issue.key} cannot move to ${move.toStatusName}: ${move.blockedBy.join('; ')}`,
      );
    }
    if (move.toStatusId === issue.statusId) return `${issue.key} is already ${move.toStatusName}`;
    await services.issues.update(ctx, issue.key, { statusId: move.toStatusId });
    return `Moved ${issue.key} to ${move.toStatusName}`;
  },
};
