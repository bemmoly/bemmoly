import type { SettingsRegistry } from '@bemmoly/core';
import { z } from 'zod';

declare module '@bemmoly/core' {
  interface SettingsKeys {
    'pipelines.rollout.holdMinutes': number;
    'pipelines.rollout.watchMinutes': number;
    'pipelines.rollout.sampleSeconds': number;
    'pipelines.promotions.expiryHours': number;
    'pipelines.approvals.validHours': number;
  }
}

/** The values the read side needs, with their defaults, so a missing setting is never fatal. */
export const SHIPPING_DEFAULTS = {
  holdMinutes: 10,
  watchMinutes: 10,
  sampleSeconds: 60,
  expiryHours: 24,
  validHours: 24,
} as const;

/**
 * Rollout defaults a plan starts from (architecture §11, §13): how long each canary step is
 * held, how long the new revision is watched at 100%, and how often it is judged. A demo on
 * a laptop shortens them; a policy or a person can only make a plan more careful.
 */
export function defineShippingSettings(settings: SettingsRegistry): void {
  settings.define({
    key: 'pipelines.rollout.holdMinutes',
    schema: z.number().int().min(0).max(240),
    default: SHIPPING_DEFAULTS.holdMinutes,
  });
  settings.define({
    key: 'pipelines.rollout.watchMinutes',
    schema: z.number().int().min(0).max(1440),
    default: SHIPPING_DEFAULTS.watchMinutes,
  });
  settings.define({
    key: 'pipelines.rollout.sampleSeconds',
    schema: z.number().int().min(5).max(600),
    default: SHIPPING_DEFAULTS.sampleSeconds,
  });
  /** A promotion nobody approves in this time is cancelled. */
  settings.define({
    key: 'pipelines.promotions.expiryHours',
    schema: z
      .number()
      .int()
      .min(1)
      .max(24 * 14),
    default: SHIPPING_DEFAULTS.expiryHours,
  });
  /** An approval counts for this long; a late rollout asks again. */
  settings.define({
    key: 'pipelines.approvals.validHours',
    schema: z
      .number()
      .int()
      .min(1)
      .max(24 * 14),
    default: SHIPPING_DEFAULTS.validHours,
  });
}
