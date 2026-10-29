import type { SettingsRegistry } from '@bemmoly/core';
import { z } from 'zod';

declare module '@bemmoly/core' {
  interface SettingsKeys {
    'pipelines.jobs.defaultTimeoutMinutes': number;
    'pipelines.logs.retentionDays': number;
    'pipelines.history.rewindDays': number;
    'pipelines.runners.defaultPool': string;
    'pipelines.providers.simulate': boolean;
    'pipelines.providers.local': boolean;
  }
}

/** Platform defaults a pipeline or an environment can tighten; workspace admins change them. */
export function definePipelinesSettings(settings: SettingsRegistry): void {
  /** A job that names no timeout gets this one (architecture §5.2). */
  settings.define({
    key: 'pipelines.jobs.defaultTimeoutMinutes',
    schema: z
      .number()
      .int()
      .min(1)
      .max(24 * 60),
    default: 60,
  });
  /** Logs stay hot this long, then object storage lifecycle rules take them (§19). */
  settings.define({
    key: 'pipelines.logs.retentionDays',
    schema: z.number().int().min(1).max(3650),
    default: 30,
  });
  /** Jobs whose pipeline names no pool run here; the oldest pool when no pool has this key. */
  settings.define({
    key: 'pipelines.runners.defaultPool',
    schema: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
    default: 'linux-x64',
  });
  /** How far back the Release map can rewind (§18). */
  settings.define({
    key: 'pipelines.history.rewindDays',
    schema: z.number().int().min(1).max(365),
    default: 90,
  });
  /**
   * Swaps Google Cloud for the in-memory provider, so a demo or an evaluation runs every
   * flow (connect, landing zone, deploys) without creating anything in a real cloud.
   */
  settings.define({
    key: 'pipelines.providers.simulate',
    schema: z.boolean(),
    default: false,
  });
  /**
   * Offers "This machine": deploys drive the Docker socket of the host the server runs on,
   * which on a shared install is the server's own machine, so only a laptop demo turns it on.
   */
  settings.define({
    key: 'pipelines.providers.local',
    schema: z.boolean(),
    default: false,
  });
}
