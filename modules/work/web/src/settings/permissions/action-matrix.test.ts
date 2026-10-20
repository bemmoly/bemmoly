import type { CapabilityMatrix, Role } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { actionGroups, allowedOf, roleChanges, toggle } from './action-matrix.ts';

const role = (id: string, key: string, isSystem = true): Role => ({
  id,
  key,
  name: key,
  isSystem,
  userCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const ADMIN = role('00000000-0000-7000-8000-000000000001', 'org_admin');
const MEMBER = role('00000000-0000-7000-8000-000000000002', 'member');
const SCRUM = role('00000000-0000-7000-8000-000000000003', 'scrum_master', false);

const row = (name: string, cells: Record<string, boolean>) => ({
  name,
  label: name,
  description: null,
  group: 'Projects',
  moduleId: 'work',
  cells: Object.fromEntries(
    Object.entries(cells).map(([id, allowed]) => [id, { allowed, lockedByOrg: false }]),
  ),
});

const matrix: CapabilityMatrix = {
  roles: [ADMIN, MEMBER, SCRUM],
  items: [
    row('workspace.delete', { [ADMIN.id]: true }),
    row('work.sprint.start', { [ADMIN.id]: true, [MEMBER.id]: true, [SCRUM.id]: false }),
    row('work.issue.edit', { [ADMIN.id]: true, [MEMBER.id]: true, [SCRUM.id]: true }),
  ],
};

describe('the Work actions matrix', () => {
  it('keeps only Work actions, grouped by area in catalog order', () => {
    expect(
      actionGroups(matrix).map((group) => [group.area, group.rows.map((r) => r.name)]),
    ).toEqual([
      ['Issues', ['work.issue.edit']],
      ['Sprints', ['work.sprint.start']],
    ]);
  });

  it('moves sprint start from Member to the Scrum Master in one save per role', () => {
    const base = allowedOf(matrix);
    const draft = toggle(toggle(base, 'work.sprint.start', MEMBER), 'work.sprint.start', SCRUM);
    expect(roleChanges(base, draft, matrix.roles, actionGroups(matrix))).toEqual([
      { roleId: MEMBER.id, items: [{ capability: 'work.sprint.start', allowed: false }] },
      { roleId: SCRUM.id, items: [{ capability: 'work.sprint.start', allowed: true }] },
    ]);
  });

  it('never edits the Org admin column', () => {
    const base = allowedOf(matrix);
    expect(toggle(base, 'work.sprint.start', ADMIN)).toBe(base);
  });
});
