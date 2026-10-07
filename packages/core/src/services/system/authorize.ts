import type { CapabilityName } from '@bemmoly/shared';

/** Backups, restores, updates and system health are org-admin operations. */
export const SYSTEM_CAPABILITY: CapabilityName = 'workspace.system.manage';
