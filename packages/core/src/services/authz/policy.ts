import { ForbiddenError, ValidationError, type SystemRoleKey } from '@bemmoly/shared';
import type { CatalogEntry } from './catalog.ts';

/*
 * Pure rules of the capability matrix. No I/O here, so every rule is unit tested.
 */

export const ORG_ADMIN_ROLE_KEY = 'org_admin';

export interface MatrixCell {
  allowed: boolean;
  lockedByOrg: boolean;
}

export interface RoleIdentity {
  key: string;
  isSystem: boolean;
}

function isSystemRoleKey(key: string, entry: CatalogEntry): key is SystemRoleKey {
  return Object.hasOwn(entry.defaults, key);
}

/**
 * The org-level cell for one role and capability. Org admin is the fixed column
 * of the mock and always holds everything. A stored row wins; without one, a
 * system role takes the capability's declared default and a custom role gets no.
 */
export function resolveOrgCell(
  role: RoleIdentity,
  entry: CatalogEntry | undefined,
  stored: MatrixCell | undefined,
): MatrixCell {
  if (role.key === ORG_ADMIN_ROLE_KEY) {
    return { allowed: true, lockedByOrg: stored?.lockedByOrg ?? false };
  }
  if (stored) return { allowed: stored.allowed, lockedByOrg: stored.lockedByOrg };
  if (entry && role.isSystem && isSystemRoleKey(role.key, entry)) {
    return { allowed: entry.defaults[role.key], lockedByOrg: false };
  }
  return { allowed: false, lockedByOrg: false };
}

/**
 * A project or space override may only remove a capability below the org
 * ceiling, and never touches a row the org locked.
 */
export function applyContainerOverride(org: MatrixCell, override: boolean | undefined): boolean {
  if (org.lockedByOrg || override === undefined) return org.allowed;
  return org.allowed && override;
}

export interface MatrixEdit {
  editorIsOrgAdmin: boolean;
  role: RoleIdentity;
  current: MatrixCell;
  next: { allowed: boolean; lockedByOrg?: boolean };
}

/** Throws when an edit to the org matrix is not allowed; returns the cell to store. */
export function checkMatrixEdit(edit: MatrixEdit): MatrixCell {
  const lockedByOrg = edit.next.lockedByOrg ?? edit.current.lockedByOrg;
  if (edit.role.key === ORG_ADMIN_ROLE_KEY && !edit.next.allowed) {
    throw new ValidationError('The Org admin role always holds every capability', {
      code: 'bad_request',
    });
  }
  const lockChanges = lockedByOrg !== edit.current.lockedByOrg;
  const allowedChanges = edit.next.allowed !== edit.current.allowed;
  if (!lockChanges && !allowedChanges) return { ...edit.current };
  if ((edit.current.lockedByOrg || lockChanges) && !edit.editorIsOrgAdmin) {
    throw new ForbiddenError('Only org admins can change a capability the org has locked');
  }
  return { allowed: edit.next.allowed, lockedByOrg };
}

/** A container override cannot grant beyond the org ceiling or touch a locked row. */
export function checkOverrideEdit(org: MatrixCell, allowed: boolean): void {
  if (org.lockedByOrg) {
    throw new ForbiddenError('This capability is locked by the organisation');
  }
  if (allowed && !org.allowed) {
    throw new ForbiddenError('A project or space can only remove capabilities, not add them');
  }
}
