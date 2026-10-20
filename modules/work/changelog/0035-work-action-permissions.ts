import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Sprint creation, start and completion, workflow and automation editing, and epics each
 * became an action of their own, split out of "Start and complete sprints", "Configure
 * project" and "Create and edit issues". A custom role has no cell for a new capability, which
 * reads as no, so each new action starts with every stored cell of the one it was split from,
 * org-wide and per project: every role keeps what it could do. The pairs are written here, not
 * imported, since a changeset's checksum must not move when the catalog does.
 */
const SPLITS = [
  ['work.sprint.manage', 'work.sprint.create'],
  ['work.sprint.manage', 'work.sprint.start'],
  ['work.sprint.manage', 'work.sprint.complete'],
  ['work.project.configure', 'work.workflow.configure'],
  ['work.project.configure', 'work.automation.edit'],
  ['work.issue.edit', 'work.epic.manage'],
] as const;

const TARGETS = [...new Set(SPLITS.map(([, target]) => target))];

export default changeset({
  id: '0035-work-action-permissions',
  author: 'bemmoly',
  description: 'Copy role cells onto the split Work actions',
  contexts: ['*'],
  up: async (ctx) => {
    for (const [source, target] of SPLITS) {
      await ctx.exec(sql`
        INSERT INTO role_capabilities (role_id, capability, allowed, locked_by_org)
        SELECT role_id, ${target}, allowed, locked_by_org
          FROM role_capabilities WHERE capability = ${source}
        ON CONFLICT (role_id, capability) DO NOTHING`);
      await ctx.exec(sql`
        INSERT INTO project_role_capabilities (project_id, role_id, capability, allowed)
        SELECT project_id, role_id, ${target}, allowed
          FROM project_role_capabilities WHERE capability = ${source}
        ON CONFLICT (project_id, role_id, capability) DO NOTHING`);
    }
  },
  down: async (ctx) => {
    for (const target of TARGETS) {
      await ctx.exec(sql`DELETE FROM role_capabilities WHERE capability = ${target}`);
      await ctx.exec(sql`DELETE FROM project_role_capabilities WHERE capability = ${target}`);
    }
  },
});
