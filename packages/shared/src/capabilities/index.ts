import { z } from 'zod';
import { MODULE_ID_PATTERN } from '../modules/index.ts';

/**
 * Kernel capabilities, read from the roles matrix in the People mock (Workspace
 * and AI groups). Module capabilities are namespaced by module id and declared
 * by the module through the capability registry.
 */
export const KERNEL_CAPABILITIES = [
  'workspace.billing.manage',
  'workspace.delete',
  'workspace.sso.configure',
  'workspace.roles.manage',
  'workspace.appearance.manage',
  'workspace.email.manage',
  'ai.assist.use',
  'ai.actions.run',
  'ai.models.configure',
] as const;

export type KernelCapability = (typeof KERNEL_CAPABILITIES)[number];

export type ModuleCapability = `${string}.${string}`;

export type CapabilityName = KernelCapability | ModuleCapability;

export const kernelCapabilitySchema = z.enum(KERNEL_CAPABILITIES);

const CAPABILITY_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

export const capabilityNameSchema = z
  .string()
  .regex(CAPABILITY_PATTERN, 'Capabilities look like "<area>.<action>"');

export function isKernelCapability(value: string): value is KernelCapability {
  return (KERNEL_CAPABILITIES as readonly string[]).includes(value);
}

/** A module may only declare capabilities under its own id, e.g. "work.issue.transition". */
export function isCapabilityOfModule(capability: string, moduleId: string): boolean {
  return (
    MODULE_ID_PATTERN.test(moduleId) &&
    CAPABILITY_PATTERN.test(capability) &&
    capability.startsWith(`${moduleId}.`)
  );
}
