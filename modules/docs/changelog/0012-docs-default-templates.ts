import { changeset, sql } from '@bemmoly/core/changelog';
import { BUILTIN_TEMPLATES } from '../shared/builtin-templates/index.ts';

/*
 * The six built-in templates as org-wide rows. Each is skipped when a row
 * with its key already exists, so a restore or a rerun never duplicates one,
 * and an admin's edits to a built-in survive. Down removes only built-ins.
 */
export default changeset({
  id: '0012-docs-default-templates',
  author: 'bemmoly',
  description: 'Seed the built-in templates: RFC, meeting notes, postmortem, spec, runbook, log',
  contexts: ['*'],
  up: async (ctx) => {
    for (const [index, template] of BUILTIN_TEMPLATES.entries()) {
      await ctx.exec(sql`
        INSERT INTO templates
          (space_id, key, name, description, icon, category, snapshot, fields, is_builtin, position)
        SELECT NULL, ${template.key}, ${template.name}, ${template.description}, ${template.icon},
          ${template.category}, ${JSON.stringify(template.snapshot)}::jsonb,
          ${JSON.stringify(template.fields)}::jsonb, true, ${index}
        WHERE NOT EXISTS (
          SELECT 1 FROM templates WHERE space_id IS NULL AND key = ${template.key})`);
    }
  },
  down: async (ctx) => {
    await ctx.exec(sql`DELETE FROM templates WHERE space_id IS NULL AND is_builtin`);
  },
});
