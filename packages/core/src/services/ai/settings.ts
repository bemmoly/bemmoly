import { z } from 'zod';
import type { SettingDefinition } from '../../contracts/settings.ts';

declare module '../../contracts/settings.ts' {
  interface SettingsKeys {
    'ai.enabled': boolean;
    'ai.redactEmails': boolean;
    'ai.redactNames': boolean;
    'ai.excludedSpaceIds': string[];
    'ai.excludedProjectIds': string[];
    'ai.perUserOptOutAllowed': boolean;
    'ai.monthlyBudgetUsd': number | null;
    'ai.liveCatalog': boolean;
  }
}

/**
 * Settings › AI beyond the wizard's three keys (ai.providerId, ai.shareContent,
 * ai.allowActions, which the kernel defines). AI is off by default; turning it off keeps the
 * providers and roles. The live catalog fetch is on by default: it carries no workspace data.
 */
export const AI_SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  { key: 'ai.enabled', schema: z.boolean(), default: false },
  { key: 'ai.redactEmails', schema: z.boolean(), default: false },
  { key: 'ai.redactNames', schema: z.boolean(), default: false },
  { key: 'ai.excludedSpaceIds', schema: z.array(z.uuid()).max(1000), default: [] },
  { key: 'ai.excludedProjectIds', schema: z.array(z.uuid()).max(1000), default: [] },
  { key: 'ai.perUserOptOutAllowed', schema: z.boolean(), default: false },
  {
    key: 'ai.monthlyBudgetUsd',
    schema: z.number().nonnegative().max(1_000_000).nullable(),
    default: null,
  },
  { key: 'ai.liveCatalog', schema: z.boolean(), default: true },
];
