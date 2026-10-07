import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * The system roles and kernel capability defaults from the roles matrix in the
 * People mock. Columns: Org admin, Project admin, Member, Viewer, Contractor.
 * Frozen data: later capability changes ship as new changesets.
 */
const ROLES = [
  ['org_admin', 'Org admin'],
  ['project_admin', 'Project admin'],
  ['member', 'Member'],
  ['viewer', 'Viewer'],
  ['contractor', 'Contractor'],
] as const;

const MATRIX: ReadonlyArray<readonly [string, readonly number[], boolean]> = [
  ['workspace.billing.manage', [1, 0, 0, 0, 0], true],
  ['workspace.delete', [1, 0, 0, 0, 0], true],
  ['workspace.sso.configure', [1, 0, 0, 0, 0], true],
  ['workspace.roles.manage', [1, 0, 0, 0, 0], true],
  ['workspace.appearance.manage', [1, 0, 0, 0, 0], false],
  ['workspace.settings.manage', [1, 0, 0, 0, 0], false],
  ['workspace.modules.manage', [1, 0, 0, 0, 0], false],
  ['workspace.system.manage', [1, 0, 0, 0, 0], false],
  ['workspace.email.manage', [1, 0, 0, 0, 0], false],
  ['workspace.audit.view', [1, 0, 0, 0, 0], false],
  ['ai.assist.use', [1, 1, 1, 1, 0], false],
  ['ai.actions.run', [1, 1, 1, 0, 0], false],
  ['ai.models.configure', [1, 0, 0, 0, 0], false],
];

export default changeset({
  id: '0108-identity-seed',
  author: 'keerthi',
  description: 'Seed the system roles, kernel capability matrix and the password provider',
  contexts: ['*'],
  up: async (ctx) => {
    for (const [key, name] of ROLES) {
      await ctx.exec(sql`
        INSERT INTO roles (key, name, is_system) VALUES (${key}, ${name}, true)
        ON CONFLICT (key) DO NOTHING`);
    }
    for (const [capability, cells, locked] of MATRIX) {
      for (const [index, [key]] of ROLES.entries()) {
        await ctx.exec(sql`
          INSERT INTO role_capabilities (role_id, capability, allowed, locked_by_org)
          SELECT id, ${capability}, ${cells[index] === 1}, ${locked} FROM roles WHERE key = ${key}
          ON CONFLICT (role_id, capability) DO NOTHING`);
      }
    }
    await ctx.exec(sql`
      INSERT INTO auth_providers (kind, display_name) VALUES ('password', 'Password')
      ON CONFLICT DO NOTHING`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DELETE FROM auth_providers WHERE kind = 'password'`);
    await ctx.exec(sql`
      DELETE FROM role_capabilities
      WHERE role_id IN (SELECT id FROM roles WHERE is_system)`);
    await ctx.exec(sql`DELETE FROM roles WHERE is_system`);
  },
});
