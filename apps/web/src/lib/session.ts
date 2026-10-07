import type { SettingsViewer } from '@bemmoly/core-web';
import type { MeResponse } from '@bemmoly/shared';

/**
 * /me carries capabilities, not a role flag. Org admins hold every capability,
 * and "Delete workspace" is theirs alone by default and locked by the org, so
 * it stands in for "org admin" on pages no single capability covers.
 */
export const ORG_ADMIN_SIGNAL = 'workspace.delete';

export function isOrgAdmin(me: MeResponse): boolean {
  return me.capabilities.includes(ORG_ADMIN_SIGNAL);
}

export function can(me: MeResponse, capability: string): boolean {
  return isOrgAdmin(me) || me.capabilities.includes(capability);
}

export function viewerOf(me: MeResponse): SettingsViewer {
  return { isAdmin: isOrgAdmin(me), capabilities: me.capabilities };
}
