import { z } from 'zod';

export const KNOWN_MODULE_IDS = ['work', 'docs', 'sample'] as const;

export type KnownModuleId = (typeof KNOWN_MODULE_IDS)[number];

/** Stable, lowercase, used in config, URLs and the changelog table. */
export type ModuleId = KnownModuleId | (string & {});

export const MODULE_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

export const moduleIdSchema = z
  .string()
  .regex(MODULE_ID_PATTERN, 'Module ids are 2 to 32 lowercase letters, digits or dashes');

export function isModuleId(value: string): value is ModuleId {
  return MODULE_ID_PATTERN.test(value);
}
