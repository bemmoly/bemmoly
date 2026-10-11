import { CronExpressionParser } from 'cron-parser';
import {
  AUTOMATION_TRIGGERS,
  scheduledArgsSchema,
  type ScheduledArgs,
} from '../../../../../shared/index.ts';
import type { TriggerDefinition } from '../contract.ts';

const params = scheduledArgsSchema.refine(
  (args) => {
    try {
      CronExpressionParser.parse(args.cron, { tz: 'UTC' });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'The schedule is not a valid cron expression', path: ['cron'] },
);

/** The latest time at or before `now` the schedule fired, or null when it never has. */
export function lastFireTime(cron: string, now: Date): Date | null {
  try {
    const expression = CronExpressionParser.parse(cron, {
      tz: 'UTC',
      currentDate: new Date(now.getTime() + 1),
    });
    return expression.prev().toDate();
  } catch {
    return null;
  }
}

/** Runs on a schedule, acting on every issue the rule's conditions match (up to a limit). */
export const scheduled: TriggerDefinition<ScheduledArgs> = {
  name: AUTOMATION_TRIGGERS.scheduled,
  label: 'On a schedule',
  description: 'On a cron schedule in UTC, for every issue the conditions match',
  params,
  events: [],
  matches: () => false,
  cron: (args) => args.cron,
};
