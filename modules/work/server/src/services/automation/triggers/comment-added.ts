import { DOMAIN_EVENT_KINDS } from '@bemmoly/shared/webhooks';
import type { z } from 'zod';
import { AUTOMATION_TRIGGERS, commentAddedArgsSchema } from '../../../../../shared/index.ts';
import type { TriggerDefinition } from '../contract.ts';

export const commentAdded: TriggerDefinition<z.infer<typeof commentAddedArgsSchema>> = {
  name: AUTOMATION_TRIGGERS.commentAdded,
  label: 'Comment added',
  description: 'When someone comments on an issue',
  params: commentAddedArgsSchema,
  events: [DOMAIN_EVENT_KINDS.issueCommented],
  matches: () => true,
};
