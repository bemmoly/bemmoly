import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Spaces made before membership was managed may hold no rows at all, which
 * leaves only org admins able to open them or be asked to review. Their
 * creators join as space admins and, for a team's space, the team's people
 * join with the team's default role (Member without one), as space create
 * does today. Only missing rows are added; nobody's role changes. The down
 * keeps the rows: by then they are ordinary memberships people may rely on.
 */
export default changeset({
  id: '0014-docs-space-members-backfill',
  author: 'bemmoly',
  description: 'Make space creators and team members members of their spaces',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      INSERT INTO space_members (space_id, user_id, role_id)
      SELECT s.id, s.created_by, r.id
      FROM spaces s
      JOIN users u ON u.id = s.created_by AND u.status <> 'deactivated'
      JOIN roles r ON r.key = 'project_admin'
      ON CONFLICT (space_id, user_id) DO NOTHING`);
    await ctx.exec(sql`
      INSERT INTO space_members (space_id, user_id, role_id)
      SELECT DISTINCT ON (s.id, tm.user_id) s.id, tm.user_id,
        coalesce(t.default_role_id, (SELECT id FROM roles WHERE key = 'member'))
      FROM spaces s
      JOIN teams t ON t.id = s.team_id
      JOIN team_members tm ON tm.team_id = t.id
      JOIN users u ON u.id = tm.user_id AND u.status <> 'deactivated'
      ON CONFLICT (space_id, user_id) DO NOTHING`);
  },
  down: async () => {},
});
