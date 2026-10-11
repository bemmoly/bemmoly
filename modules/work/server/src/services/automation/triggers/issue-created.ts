import { DOMAIN_EVENT_KINDS } from '@bemmoly/shared/webhooks';
import type { z } from 'zod';
import { AUTOMATION_TRIGGERS, issueCreatedArgsSchema } from '../../../../../shared/index.ts';
import type { TriggerDefinition } from '../contract.ts';

export const issueCreated: TriggerDefinition<z.infer<typeof issueCreatedArgsSchema>> = {
  name: AUTOMATION_TRIGGERS.issueCreated,
  label: 'Issue created',
  description: 'When an issue is created',
  params: issueCreatedArgsSchema,
  events: [DOMAIN_EVENT_KINDS.issueCreated],
  matches: () => true,
};
