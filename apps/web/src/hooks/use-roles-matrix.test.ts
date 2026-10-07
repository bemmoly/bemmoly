import type { Role } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import {
  cellOf,
  groupRows,
  isRowLocked,
  rolePayloads,
  toggleCell,
  toggleRowLock,
  type CellMap,
} from './use-roles-matrix.ts';

const role = (id: string, key: string): Role => ({
  id,
  key,
  name: key,
  isSystem: true,
  userCount: 0,
  createdAt: '',
  updatedAt: '',
});

const ROLES = [role('admin', 'org_admin'), role('member', 'member'), role('viewer', 'viewer')];
const ROWS = [{ name: 'work.issue.edit' }, { name: 'workspace.delete' }];

const BASE: CellMap = {
  'work.issue.edit': {
    admin: { allowed: true, lockedByOrg: false },
    member: { allowed: true, lockedByOrg: false },
    viewer: { allowed: false, lockedByOrg: false },
  },
  'workspace.delete': {
    admin: { allowed: true, lockedByOrg: true },
    member: { allowed: false, lockedByOrg: true },
    viewer: { allowed: false, lockedByOrg: true },
  },
};

describe('roles matrix draft', () => {
  it('toggles one cell without touching the stored cells', () => {
    const next = toggleCell(BASE, 'work.issue.edit', 'viewer', ROLES);
    expect(cellOf(next, 'work.issue.edit', 'viewer').allowed).toBe(true);
    expect(cellOf(BASE, 'work.issue.edit', 'viewer').allowed).toBe(false);
    expect(cellOf(next, 'work.issue.edit', 'member')).toEqual(BASE['work.issue.edit']?.['member']);
  });

  it('never changes the Org admin column', () => {
    expect(toggleCell(BASE, 'work.issue.edit', 'admin', ROLES)).toBe(BASE);
    const unlocked = toggleRowLock(BASE, 'workspace.delete', ROLES);
    expect(cellOf(unlocked, 'workspace.delete', 'admin').lockedByOrg).toBe(true);
  });

  it('locks and unlocks every editable cell in a row', () => {
    expect(isRowLocked(BASE, 'workspace.delete', ROLES)).toBe(true);
    expect(isRowLocked(BASE, 'work.issue.edit', ROLES)).toBe(false);
    const locked = toggleRowLock(BASE, 'work.issue.edit', ROLES);
    expect(cellOf(locked, 'work.issue.edit', 'member').lockedByOrg).toBe(true);
    expect(cellOf(locked, 'work.issue.edit', 'viewer').lockedByOrg).toBe(true);
    expect(cellOf(locked, 'work.issue.edit', 'member').allowed).toBe(true);
    const unlocked = toggleRowLock(BASE, 'workspace.delete', ROLES);
    expect(isRowLocked(unlocked, 'workspace.delete', ROLES)).toBe(false);
    expect(cellOf(unlocked, 'workspace.delete', 'viewer').lockedByOrg).toBe(false);
  });

  it('locks a partly locked row rather than unlocking it', () => {
    const partial = toggleRowLock(
      toggleRowLock(BASE, 'work.issue.edit', ROLES),
      'work.issue.edit',
      ROLES,
    );
    expect(isRowLocked(partial, 'work.issue.edit', ROLES)).toBe(false);
    const mixed: CellMap = {
      ...BASE,
      'work.issue.edit': {
        ...BASE['work.issue.edit'],
        member: { allowed: true, lockedByOrg: true },
      },
    };
    expect(
      isRowLocked(toggleRowLock(mixed, 'work.issue.edit', ROLES), 'work.issue.edit', ROLES),
    ).toBe(true);
  });

  it('sends one payload per changed role with only the changed rows', () => {
    let draft = toggleCell(BASE, 'work.issue.edit', 'viewer', ROLES);
    draft = toggleRowLock(draft, 'workspace.delete', ROLES);
    expect(rolePayloads(BASE, draft, ROWS, ROLES)).toEqual([
      {
        roleId: 'member',
        items: [{ capability: 'workspace.delete', allowed: false, lockedByOrg: false }],
      },
      {
        roleId: 'viewer',
        items: [
          { capability: 'work.issue.edit', allowed: true, lockedByOrg: false },
          { capability: 'workspace.delete', allowed: false, lockedByOrg: false },
        ],
      },
    ]);
  });

  it('sends nothing when a change is undone', () => {
    const twice = toggleCell(
      toggleCell(BASE, 'work.issue.edit', 'viewer', ROLES),
      'work.issue.edit',
      'viewer',
      ROLES,
    );
    expect(rolePayloads(BASE, twice, ROWS, ROLES)).toEqual([]);
  });

  it('keeps groups in server order', () => {
    const row = (name: string, group: string) => ({
      name,
      label: name,
      description: null,
      group,
      moduleId: null,
      cells: {},
    });
    const groups = groupRows([row('a', 'Workspace'), row('b', 'Projects'), row('c', 'Workspace')]);
    expect(groups.map((group) => [group.name, group.rows.map((r) => r.name)])).toEqual([
      ['Workspace', ['a', 'c']],
      ['Projects', ['b']],
    ]);
  });
});
