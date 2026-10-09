import type { SettingsRegistry } from '@bemmoly/core';
import { z } from 'zod';
import { estimationUnitSchema, workMethodSchema } from '../../../shared/enums.ts';

declare module '@bemmoly/core' {
  interface SettingsKeys {
    'work.defaultMethod': 'scrum' | 'kanban';
    'work.defaultEstimationUnit': 'points' | 'hours' | 'tshirt' | 'none';
    'work.jobs.rankRebalance.schedule': string;
  }
}

/** What a new project inherits, as the Board Settings mock's Method and estimation tab defaults. */
export function defineWorkSettings(settings: SettingsRegistry): void {
  settings.define({ key: 'work.defaultMethod', schema: workMethodSchema, default: 'scrum' });
  settings.define({
    key: 'work.defaultEstimationUnit',
    schema: estimationUnitSchema,
    default: 'points',
  });
  settings.define({
    key: 'work.jobs.rankRebalance.schedule',
    schema: z.string().trim().min(1).max(100),
    /** Nightly, in the quiet period, as the housekeeping jobs run. */
    default: '15 3 * * *',
  });
}
