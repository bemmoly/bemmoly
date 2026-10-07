import { ROLE_IDS } from './people.ts';

export interface CapabilityRow {
  name: string;
  label: string;
  description: string | null;
  group: string;
  moduleId: string | null;
}

export type Cells = Record<string, Record<string, { allowed: boolean; lockedByOrg: boolean }>>;

type Seed = [string, string, string | null, [number, number, number, number, number]];

/** The People mock's matrix: Workspace and AI from the kernel, Projects and Docs from modules. */
const GROUPS: Array<{ group: string; moduleId: string | null; rows: Seed[] }> = [
  {
    group: 'Workspace',
    moduleId: null,
    rows: [
      ['workspace.billing.manage', 'Manage billing and license', null, [1, 0, 0, 0, 0]],
      ['workspace.delete', 'Delete workspace', null, [1, 0, 0, 0, 0]],
      ['workspace.sso.configure', 'Configure SSO', null, [1, 0, 0, 0, 0]],
      [
        'workspace.roles.manage',
        'Manage org roles',
        'Create roles, edit this page',
        [1, 0, 0, 0, 0],
      ],
      ['workspace.appearance.manage', 'Set appearance and themes', null, [1, 0, 0, 0, 0]],
      [
        'workspace.email.manage',
        'Manage email delivery',
        'SMTP, test sends, the dev mailbox',
        [1, 0, 0, 0, 0],
      ],
      ['workspace.audit.view', 'View the audit log', null, [1, 0, 0, 0, 0]],
    ],
  },
  {
    group: 'Projects',
    moduleId: 'work',
    rows: [
      ['work.project.create', 'Create projects', null, [1, 1, 0, 0, 0]],
      [
        'work.project.configure',
        'Configure project',
        'Board, workflow, fields, members',
        [1, 1, 0, 0, 0],
      ],
      ['work.issue.edit', 'Create and edit issues', null, [1, 1, 1, 0, 1]],
      ['work.issue.delete', 'Delete issues', 'Soft delete, 30-day recovery', [1, 1, 0, 0, 0]],
      ['work.issue.view', 'View issues', null, [1, 1, 1, 1, 1]],
    ],
  },
  {
    group: 'Docs',
    moduleId: 'docs',
    rows: [
      ['docs.space.create', 'Create spaces', null, [1, 1, 0, 0, 0]],
      ['docs.page.edit', 'Edit pages', null, [1, 1, 1, 0, 1]],
      ['docs.page.publish', 'Publish and restrict pages', null, [1, 1, 1, 0, 0]],
      ['docs.space.export', 'Export space', null, [1, 1, 0, 0, 0]],
    ],
  },
  {
    group: 'AI',
    moduleId: null,
    rows: [
      ['ai.assist.use', 'Use AI assist', 'Summaries, drafting, search', [1, 1, 1, 1, 0]],
      [
        'ai.actions.run',
        'Run AI actions that change data',
        'Bulk moves, auto-created issues',
        [1, 1, 1, 0, 0],
      ],
      ['ai.models.configure', 'Configure models and data policy', null, [1, 0, 0, 0, 0]],
    ],
  },
];

const LOCKED = new Set([
  'workspace.billing.manage',
  'workspace.delete',
  'workspace.sso.configure',
  'workspace.roles.manage',
]);

const COLUMNS = [
  ROLE_IDS.admin,
  ROLE_IDS.projectAdmin,
  ROLE_IDS.member,
  ROLE_IDS.viewer,
  ROLE_IDS.contractor,
];

export function seedCapabilities(): { rows: CapabilityRow[]; cells: Cells } {
  const rows: CapabilityRow[] = [];
  const cells: Cells = {};
  for (const { group, moduleId, rows: seeds } of GROUPS) {
    for (const [name, label, description, values] of seeds) {
      rows.push({ name, label, description, group, moduleId });
      cells[name] = Object.fromEntries(
        COLUMNS.map((roleId, column) => [
          roleId,
          { allowed: values[column] === 1, lockedByOrg: LOCKED.has(name) },
        ]),
      );
    }
  }
  return { rows, cells };
}
