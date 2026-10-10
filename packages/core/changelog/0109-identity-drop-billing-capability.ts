import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * "Manage billing and license" guarded nothing and there is nothing to buy, so
 * the capability left the catalog. Its stored grants go too. The previous minor
 * still lists the row and, finding no stored cell, falls back to its catalog
 * default (org admin only), so a rollback of the app alone stays safe.
 */
const RETIRED = 'workspace.billing.manage';

export default changeset({
  id: '0109-identity-drop-billing-capability',
  author: 'keerthi',
  description: 'Delete stored grants of the retired workspace.billing.manage capability',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`DELETE FROM role_capabilities WHERE capability = ${RETIRED}`);
    await ctx.exec(sql`DELETE FROM project_role_capabilities WHERE capability = ${RETIRED}`);
    await ctx.exec(sql`DELETE FROM space_role_capabilities WHERE capability = ${RETIRED}`);
  },
  // Restores the system roles' cells as 0108 seeded them; custom roles fall back to "not allowed".
  down: async (ctx) => {
    await ctx.exec(sql`
      INSERT INTO role_capabilities (role_id, capability, allowed, locked_by_org)
      SELECT id, ${RETIRED}, key = 'org_admin', true FROM roles WHERE is_system
      ON CONFLICT (role_id, capability) DO NOTHING`);
  },
});
