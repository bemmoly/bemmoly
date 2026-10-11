import { SETTING_SCHEMAS } from '@bemmoly/shared';
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
    'appearance.defaultMode': 'light' | 'dark' | 'system';
    'appearance.customThemeId': string | null;
    'appearance.mode': 'light' | 'dark';
    'appearance.surfaces': 'neutral' | 'tinted';
    'appearance.memberModeSwitch': boolean;
    'appearance.personalThemes': boolean;
    'workspace.locale': string;
    'workspace.timezone': string;
    'ai.providerId': string | null;
    'ai.shareContent': boolean;
    'ai.allowActions': boolean;
    'setup.completedAt': string | null;
    'mcp.enabled': boolean;
    'mcp.modules': string[] | null;
  }
}

/** Five-field cron, as pg-boss schedules accept. */
export const cronSchema = z
  .string()
  .trim()
  .regex(/^(\S+\s+){4}\S+$/, 'Use a five-field cron expression, e.g. "0 * * * *"');

const themeName = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/, 'A theme or font id, e.g. "bemmoly"');

/**
 * Settings the kernel owns. Other kernel services pass their own lists (for
 * example the email service's EMAIL_SETTING_DEFINITIONS) to the catalog.
 */
export const KERNEL_SETTINGS: readonly SettingDefinition[] = [
  { key: 'workspace.name', schema: z.string().trim().min(1).max(80), default: 'Bemmoly' },
  { key: 'workspace.url', schema: z.union([z.literal(''), z.url()]), default: '' },
  { key: 'appearance.theme', schema: themeName, default: 'bemmoly' },
  {
    key: 'appearance.brandColor',
    schema: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'A hex colour such as #2356c9'),
    default: '#2356c9',
  },
  { key: 'appearance.font', schema: themeName, default: 'plex' },
  // New workspaces follow each device; upgraded ones keep their old preset's mode (0600).
  {
    key: 'appearance.defaultMode',
    schema: SETTING_SCHEMAS['appearance.defaultMode'],
    default: 'system',
  },
  {
    key: 'appearance.customThemeId',
    schema: SETTING_SCHEMAS['appearance.customThemeId'],
    default: null,
  },
  { key: 'appearance.logoKey', schema: z.string().max(512), default: '' },
  { key: 'system.storage.backend', schema: z.enum(['disk', 's3']), default: 'disk' },
  { key: 'system.jobs.housekeeping.schedule', schema: cronSchema, default: '0 * * * *' },
  // Retired with the presets (ADR 0021); kept while the previous minor reads them.
  { key: 'appearance.mode', schema: SETTING_SCHEMAS['appearance.mode'], default: 'light' },
  {
    key: 'appearance.surfaces',
    schema: SETTING_SCHEMAS['appearance.surfaces'],
    default: 'neutral',
  },
  { key: 'appearance.memberModeSwitch', schema: z.boolean(), default: true },
  { key: 'appearance.personalThemes', schema: z.boolean(), default: false },
  { key: 'workspace.locale', schema: SETTING_SCHEMAS['workspace.locale'], default: 'en' },
  { key: 'workspace.timezone', schema: SETTING_SCHEMAS['workspace.timezone'], default: 'UTC' },
  // The setup wizard's AI step, until the AI runtime owns its provider records.
  { key: 'ai.providerId', schema: z.string().min(1).nullable(), default: null },
  { key: 'ai.shareContent', schema: z.boolean(), default: false },
  { key: 'ai.allowActions', schema: z.boolean(), default: false },
  // Written by the wizard's last step; the shell resumes the wizard until it is set.
  { key: 'setup.completedAt', schema: z.iso.datetime().nullable(), default: null },
  // The built-in MCP server is off until an admin turns it on; AI settings never gate it.
  { key: 'mcp.enabled', schema: SETTING_SCHEMAS['mcp.enabled'], default: false },
  { key: 'mcp.modules', schema: SETTING_SCHEMAS['mcp.modules'], default: null },
];
