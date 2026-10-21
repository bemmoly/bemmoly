import {
  AUTOMATION_TRIGGERS,
  timeInStatusArgsSchema,
  type TimeInStatusArgs,
} from '../../../../../shared/index.ts';
import type { TriggerDefinition } from '../contract.ts';

const HOUR_MS = 60 * 60 * 1000;

/** Fired by the scheduler, once per stay, for an issue that has sat in a status too long. */
export const timeInStatus: TriggerDefinition<TimeInStatusArgs> = {
  name: AUTOMATION_TRIGGERS.timeInStatus,
  label: 'Time in status',
  description: 'When an issue has been in a status for longer than a number of hours or days',
  params: timeInStatusArgsSchema,
  events: [],
  matches: () => false,
  stay: (args) => ({
    status: args.status,
    ms: args.amount * (args.unit === 'days' ? 24 : 1) * HOUR_MS,
  }),
};
