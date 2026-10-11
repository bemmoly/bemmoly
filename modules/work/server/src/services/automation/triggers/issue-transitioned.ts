import { DOMAIN_EVENT_KINDS } from '@bemmoly/shared/webhooks';
import {
  AUTOMATION_TRIGGERS,
  issueTransitionedArgsSchema,
  type IssueTransitionedArgs,
} from '../../../../../shared/index.ts';
import type { TriggerDefinition } from '../contract.ts';

const same = (wanted: string | undefined, actual: string | undefined) =>
  wanted === undefined || wanted.toLowerCase() === (actual ?? '').toLowerCase();

export const issueTransitioned: TriggerDefinition<IssueTransitionedArgs> = {
  name: AUTOMATION_TRIGGERS.issueTransitioned,
  label: 'Issue transitioned',
  description: 'When an issue moves between statuses, optionally from or to one by name',
  params: issueTransitionedArgsSchema,
  events: [DOMAIN_EVENT_KINDS.issueTransitioned],
  matches: (args, event) =>
    same(args.fromStatus, event.payload.fromStatus) && same(args.toStatus, event.payload.toStatus),
};
