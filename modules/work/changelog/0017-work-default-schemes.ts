import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The org default issue types and fields from the Workflow mock, with the
 * create-form layout of each type. Frozen data, like the kernel's role seed:
 * admins edit the rows in place and later changes to the defaults ship as
 * new changesets. Workflow and board defaults are seeded by their own areas.
 */
const TYPES: ReadonlyArray<readonly [string, string, string, string, string, string]> = [
  ['epic', 'Epic', 'epic', '◆', '#8b5cf6', 'Large body of work spanning sprints'],
  ['story', 'Story', 'standard', '▮', '#2b9b5a', 'User-facing functionality, estimated in points'],
  ['bug', 'Bug', 'standard', '●', '#d93838', 'A defect in shipped behavior'],
  ['task', 'Task', 'standard', '✓', '#2456c9', 'Technical or operational work'],
  ['incident', 'Incident', 'standard', '!', '#e0632a', 'Production incident with severity'],
  ['subtask', 'Subtask', 'subtask', '–', '#6b7483', 'Child of any standard issue'],
];

const option = (value: string, label: string) => ({ value, label });

const FIELDS: ReadonlyArray<readonly [string, string, string, unknown[], boolean]> = [
  ['acceptance_criteria', 'Acceptance criteria', 'richtext', [], false],
  ['design_link', 'Design link', 'url', [], false],
  [
    'severity',
    'Severity',
    'select',
    [option('sev1', 'Sev 1'), option('sev2', 'Sev 2'), option('sev3', 'Sev 3')],
    true,
  ],
  [
    'environment',
    'Environment',
    'select',
    [option('production', 'Production'), option('staging', 'Staging'), option('dev', 'Dev')],
    true,
  ],
  ['steps_to_reproduce', 'Steps to reproduce', 'richtext', [], false],
  ['target_date', 'Target date', 'date', [], true],
  ['owner', 'Owner', 'user', [], true],
];

/** Type key, field key, required, on card; positions follow this order per type. */
const LAYOUT: ReadonlyArray<readonly [string, string, boolean, boolean]> = [
  ['story', 'acceptance_criteria', true, false],
  ['story', 'design_link', false, false],
  ['bug', 'severity', true, true],
  ['bug', 'environment', true, false],
  ['bug', 'steps_to_reproduce', true, false],
  ['incident', 'severity', true, true],
  ['incident', 'environment', true, false],
  ['epic', 'target_date', true, false],
  ['epic', 'owner', true, false],
];

export default changeset({
  id: '0017-work-default-schemes',
  author: 'bemmoly',
  description: 'Seed the org default issue types, fields and create-form layouts',
  contexts: ['*'],
  up: async (ctx) => {
    for (const [index, [key, name, level, icon, color, description]] of TYPES.entries()) {
      await ctx.exec(sql`
        INSERT INTO issue_types (project_id, key, name, description, icon, color, level, position)
        VALUES (NULL, ${key}, ${name}, ${description}, ${icon}, ${color}, ${level}, ${index})
        ON CONFLICT (key) WHERE project_id IS NULL DO NOTHING`);
    }
    for (const [key, name, kind, options, filterable] of FIELDS) {
      await ctx.exec(sql`
        INSERT INTO fields (project_id, key, name, kind, options, filterable)
        VALUES (NULL, ${key}, ${name}, ${kind}, ${JSON.stringify(options)}::jsonb, ${filterable})
        ON CONFLICT (key) WHERE project_id IS NULL DO NOTHING`);
    }
    const positions = new Map<string, number>();
    for (const [typeKey, fieldKey, required, onCard] of LAYOUT) {
      const position = positions.get(typeKey) ?? 0;
      positions.set(typeKey, position + 1);
      await ctx.exec(sql`
        INSERT INTO issue_type_fields (issue_type_id, field_id, required, on_card, position)
        SELECT t.id, f.id, ${required}, ${onCard}, ${position}
        FROM issue_types t, fields f
        WHERE t.project_id IS NULL AND t.key = ${typeKey}
          AND f.project_id IS NULL AND f.key = ${fieldKey}
        ON CONFLICT (issue_type_id, field_id) DO NOTHING`);
    }
  },
  down: async (ctx) => {
    await ctx.exec(sql`
      DELETE FROM issue_type_fields
      WHERE issue_type_id IN (SELECT id FROM issue_types WHERE project_id IS NULL)`);
    await ctx.exec(sql`DELETE FROM fields WHERE project_id IS NULL`);
    await ctx.exec(sql`DELETE FROM issue_types WHERE project_id IS NULL`);
  },
});
