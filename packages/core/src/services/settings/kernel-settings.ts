import { z } from 'zod';
import type { SettingDefinition } from '../../contracts/settings.ts';

declare module '../../contracts/settings.ts' {
  interface SettingsKeys {
    'workspace.url': string;
    'appearance.theme': string;
    'appearance.brandColor': string;
    'appearance.font': string;
    'appearance.logoKey': string;
    'system.storage.backend': 'disk' | 's3';
    'system.jobs.housekeeping.schedule': string;
  }
}

/** Five-field cron, as pg-boss schedules accept. */
export const cronSchema = z
  .string()
  .trim()
  .regex(/^(\S+\s+){4}\S+$/, 'Use a five-field cron expression, e.g. "0 * * * *"');

const presetName = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,39}$/, 'A preset or font id, e.g. "classic"');

/**
 * Settings the kernel owns. Other kernel services pass their own lists (for
 * example the email service's EMAIL_SETTING_DEFINITIONS) to the catalog.
 */
export const KERNEL_SETTINGS: readonly SettingDefinition[] = [
  { key: 'workspace.name', schema: z.string().trim().min(1).max(80), default: 'Bemmoly' },
  { key: 'workspace.url', schema: z.union([z.literal(''), z.url()]), default: '' },
  { key: 'appearance.theme', schema: presetName, default: 'classic' },
  {
    key: 'appearance.brandColor',
    schema: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'A hex colour such as #2456c9'),
    default: '#2456c9',
  },
  { key: 'appearance.font', schema: presetName, default: 'plex' },
  { key: 'appearance.logoKey', schema: z.string().max(512), default: '' },
  { key: 'system.storage.backend', schema: z.enum(['disk', 's3']), default: 'disk' },
  { key: 'system.jobs.housekeeping.schedule', schema: cronSchema, default: '0 * * * *' },
];
