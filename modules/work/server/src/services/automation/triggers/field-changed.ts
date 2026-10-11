import { DOMAIN_EVENT_KINDS } from '@bemmoly/shared/webhooks';
import {
  AUTOMATION_TRIGGERS,
  fieldChangedArgsSchema,
  type FieldChangedArgs,
} from '../../../../../shared/index.ts';
import type { TriggerDefinition } from '../contract.ts';

export const fieldChanged: TriggerDefinition<FieldChangedArgs> = {
  name: AUTOMATION_TRIGGERS.fieldChanged,
  label: 'Field changed',
  description: 'When one of the chosen fields of an issue changes',
  params: fieldChangedArgsSchema,
  events: [DOMAIN_EVENT_KINDS.issueUpdated],
  matches: (args, event) =>
    (event.payload.fields ?? []).some((field) => args.fields.includes(field)),
};
