import { ForbiddenError, ValidationError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { KERNEL_CAPABILITY_CATALOG, moduleOfCapability, type CatalogEntry } from './catalog.ts';
import {
  applyContainerOverride,
  checkMatrixEdit,
  checkOverrideEdit,
  resolveOrgCell,
} from './policy.ts';

const entry = (name: string): CatalogEntry => {
  const found = KERNEL_CAPABILITY_CATALOG.find((item) => item.name === name);
  if (!found) throw new Error(name);
  return found;
};

const member = { key: 'member', isSystem: true };
const custom = { key: 'people_manager', isSystem: false };
const orgAdmin = { key: 'org_admin', isSystem: true };

describe('resolveOrgCell', () => {
  it('gives Org admin every capability whatever is stored', () => {
    const stored = { allowed: false, lockedByOrg: true };
    expect(resolveOrgCell(orgAdmin, entry('workspace.delete'), stored)).toEqual({
      allowed: true,
      lockedByOrg: true,
    });
    expect(resolveOrgCell(orgAdmin, undefined, undefined).allowed).toBe(true);
  });

  it('prefers the stored row, then the system default, then no', () => {
    const ai = entry('ai.actions.run');
    expect(resolveOrgCell(member, ai, { allowed: false, lockedByOrg: false }).allowed).toBe(false);
    expect(resolveOrgCell(member, ai, undefined)).toEqual({ allowed: true, lockedByOrg: false });
    expect(resolveOrgCell({ key: 'viewer', isSystem: true }, ai, undefined).allowed).toBe(false);
    expect(resolveOrgCell(custom, ai, undefined).allowed).toBe(false);
  });

  it('returns only the cell fields, never extra row columns', () => {
    const row = { allowed: true, lockedByOrg: false, capability: 'ai.assist.use' };
    expect(resolveOrgCell(member, entry('ai.assist.use'), row)).toEqual({
      allowed: true,
      lockedByOrg: false,
    });
  });
});

describe('applyContainerOverride', () => {
  it('only narrows, and ignores overrides on locked rows', () => {
    expect(applyContainerOverride({ allowed: true, lockedByOrg: false }, false)).toBe(false);
    expect(applyContainerOverride({ allowed: false, lockedByOrg: false }, true)).toBe(false);
    expect(applyContainerOverride({ allowed: true, lockedByOrg: true }, false)).toBe(true);
    expect(applyContainerOverride({ allowed: true, lockedByOrg: false }, undefined)).toBe(true);
  });
});

describe('checkMatrixEdit', () => {
  const unlocked = { allowed: false, lockedByOrg: false };
  const locked = { allowed: false, lockedByOrg: true };

  it('lets anyone allowed to manage roles change an unlocked row', () => {
    expect(
      checkMatrixEdit({
        editorIsOrgAdmin: false,
        role: member,
        current: unlocked,
        next: { allowed: true },
      }),
    ).toEqual({ allowed: true, lockedByOrg: false });
  });

  it('reserves locked rows and the lock itself to org admins', () => {
    expect(() =>
      checkMatrixEdit({
        editorIsOrgAdmin: false,
        role: member,
        current: locked,
        next: { allowed: true },
      }),
    ).toThrow(ForbiddenError);
    expect(() =>
      checkMatrixEdit({
        editorIsOrgAdmin: false,
        role: member,
        current: unlocked,
        next: { allowed: false, lockedByOrg: true },
      }),
    ).toThrow(ForbiddenError);
    expect(
      checkMatrixEdit({
        editorIsOrgAdmin: true,
        role: member,
        current: locked,
        next: { allowed: true },
      }),
    ).toEqual({ allowed: true, lockedByOrg: true });
  });

  it('treats an unchanged locked row as a no-op rather than a violation', () => {
    expect(
      checkMatrixEdit({
        editorIsOrgAdmin: false,
        role: member,
        current: locked,
        next: { allowed: false },
      }),
    ).toEqual(locked);
  });

  it('never removes a capability from the Org admin column', () => {
    expect(() =>
      checkMatrixEdit({
        editorIsOrgAdmin: true,
        role: orgAdmin,
        current: { allowed: true, lockedByOrg: false },
        next: { allowed: false },
      }),
    ).toThrow(ValidationError);
  });
});

describe('checkOverrideEdit', () => {
  it('refuses locked rows and grants above the org ceiling', () => {
    expect(() => checkOverrideEdit({ allowed: true, lockedByOrg: true }, false)).toThrow(
      ForbiddenError,
    );
    expect(() => checkOverrideEdit({ allowed: false, lockedByOrg: false }, true)).toThrow(
      ForbiddenError,
    );
    expect(() => checkOverrideEdit({ allowed: true, lockedByOrg: false }, false)).not.toThrow();
  });
});

describe('capability catalog', () => {
  it('matches the People mock: only Org admin holds workspace rows; AI assist reaches Viewer', () => {
    for (const item of KERNEL_CAPABILITY_CATALOG.filter(
      (capability) => capability.group === 'Workspace',
    )) {
      expect(item.defaults).toEqual({
        org_admin: true,
        project_admin: false,
        member: false,
        viewer: false,
        contractor: false,
      });
    }
    expect(entry('ai.assist.use').defaults).toMatchObject({ viewer: true, contractor: false });
    expect(entry('ai.actions.run').defaults).toMatchObject({ member: true, viewer: false });
  });

  it('maps module capabilities to their module and kernel ones to none', () => {
    expect(moduleOfCapability('work.issue.transition')).toBe('work');
    expect(moduleOfCapability('workspace.delete')).toBeNull();
    expect(moduleOfCapability('ai.assist.use')).toBeNull();
  });
});
