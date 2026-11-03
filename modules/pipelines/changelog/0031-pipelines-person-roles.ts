import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Roles decide what you see: each person holds one of four roles for the whole organisation,
 * for as long as they have it. So a binding may now name the approve-only `approver` role,
 * and a binding to one person at the organisation needs no end time; elsewhere a binding to a
 * person is still break-glass and still expires.
 */
export default changeset({
  id: '0031-pipelines-person-roles',
  author: 'bemmoly',
  description: 'Allow the approver role and permanent organisation roles for one person',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_role_bindings
        DROP CONSTRAINT pipeline_role_bindings_role_check,
        DROP CONSTRAINT pipeline_role_bindings_check1,
        ADD CONSTRAINT pipeline_role_bindings_role_check CHECK (role IN (
          'viewer', 'developer', 'maintainer', 'release_manager', 'platform_admin', 'auditor',
          'approver'
        )),
        ADD CONSTRAINT pipeline_role_bindings_user_expiry_check CHECK (
          subject_kind = 'team' OR expires_at IS NOT NULL OR scope_kind = 'organisation'
        )`);
  },
  down: async (ctx) => {
    // The previous release knows neither: approvers and permanent personal roles go.
    await ctx.exec(sql`
      DELETE FROM pipeline_role_bindings
      WHERE role = 'approver' OR (subject_kind = 'user' AND expires_at IS NULL)`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_role_bindings
        DROP CONSTRAINT pipeline_role_bindings_user_expiry_check,
        DROP CONSTRAINT pipeline_role_bindings_role_check,
        ADD CONSTRAINT pipeline_role_bindings_role_check CHECK (role IN (
          'viewer', 'developer', 'maintainer', 'release_manager', 'platform_admin', 'auditor'
        )),
        ADD CONSTRAINT pipeline_role_bindings_check1 CHECK (
          subject_kind = 'team' OR expires_at IS NOT NULL
        )`);
  },
});
