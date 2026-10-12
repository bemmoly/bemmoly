import type { ImportJobDiscovery, ImportMapping, ImportSource } from '@bemmoly/shared';
import type { MockContainer } from './import-containers.ts';

/** The sources the server offers, keyed by the module that brings them. */
export const MOCK_IMPORT_SOURCES: readonly ImportSource[] = [
  {
    id: 'jira',
    moduleId: 'work',
    label: 'Jira',
    description:
      'Projects, issues, comments, attachments and people from Jira Cloud or Data Center.',
    brings: ['Projects', 'People', 'Issues', 'Comments', 'Attachments'],
    options: [
      { name: 'comments', label: 'Comments', description: 'With authors and dates', default: true },
      {
        name: 'attachments',
        label: 'Attachments',
        description: 'Stored in Bemmoly file storage',
        default: true,
      },
      {
        name: 'agile',
        label: 'Sprints and boards',
        description: 'Board columns become workflow states',
        default: true,
      },
      {
        name: 'links',
        label: 'Links between issues',
        description: 'Blocks, relates to, duplicates',
        default: true,
      },
    ],
    nouns: {
      container: 'project',
      containers: 'projects',
      records: 'issues',
      target: 'Work project',
    },
    fields: [
      {
        name: 'deployment',
        label: 'Deployment',
        kind: 'select',
        required: true,
        options: [
          { value: 'cloud', label: 'Cloud' },
          { value: 'datacenter', label: 'Data Center' },
        ],
      },
      {
        name: 'siteUrl',
        label: 'Site address',
        kind: 'url',
        required: true,
        placeholder: 'https://acme.example.net',
      },
      {
        name: 'email',
        label: 'Account email',
        kind: 'email',
        required: true,
        showWhen: { field: 'deployment', values: ['cloud'] },
      },
      {
        name: 'token',
        label: 'API token',
        kind: 'secret',
        required: true,
        help: 'Create one in your account security settings.',
      },
    ],
  },
  {
    id: 'csv',
    moduleId: 'work',
    label: 'CSV file',
    description: 'Issues from a spreadsheet export; columns are matched to fields by their names.',
    brings: ['Issues'],
    options: [],
    nouns: { container: 'file', containers: 'files', records: 'issues', target: 'Work project' },
    fields: [
      {
        name: 'file',
        label: 'CSV file',
        kind: 'file',
        required: true,
        help: 'The first row names the columns: Summary, Status, Assignee, Labels.',
      },
    ],
  },
  {
    id: 'confluence',
    moduleId: 'docs',
    label: 'Confluence',
    description: 'Spaces, page trees, pages and their comments from Confluence.',
    brings: ['Spaces', 'Pages', 'Comments'],
    options: [
      {
        name: 'comments',
        label: 'Comments',
        description: 'Page and inline comments, with authors',
        default: true,
      },
      {
        name: 'attachments',
        label: 'Attachments',
        description: 'Stored in Bemmoly file storage',
        default: true,
      },
    ],
    nouns: { container: 'space', containers: 'spaces', records: 'pages', target: 'Docs space' },
    fields: [
      {
        name: 'siteUrl',
        label: 'Site address',
        kind: 'url',
        required: true,
        placeholder: 'https://acme.example.net/wiki',
      },
      { name: 'email', label: 'Account email', kind: 'email', required: true },
      { name: 'token', label: 'API token', kind: 'secret', required: true },
    ],
  },
];

/** The job's discovery: the site, its totals and warnings; the rows are listed apart. */
export function mockDiscovery(
  source: string,
  site: string,
  rows: readonly MockContainer[],
): ImportJobDiscovery {
  const records = rows.reduce((sum, row) => sum + (row.lazy ? 0 : row.records), 0);
  if (source === 'csv') {
    return {
      site: 'issues.csv',
      counts: { issues: records },
      warnings: ['3 rows have no Summary and will be skipped.'],
      total: rows.length,
    };
  }
  if (source === 'confluence') {
    return {
      site,
      counts: { spaces: rows.length, pages: records },
      warnings: [],
      total: rows.length,
    };
  }
  return {
    site,
    counts: { projects: rows.length, issues: records, users: 24 },
    warnings: ['Custom field "Story points (old)" has no match and will be reported.'],
    total: rows.length,
  };
}

export function mockMappings(source: string): ImportMapping[] {
  if (source === 'csv') {
    return [
      { kind: 'field', source: 'Summary', action: 'match', target: 'Title', note: null },
      { kind: 'field', source: 'Status', action: 'match', target: 'Status', note: null },
      { kind: 'field', source: 'Sprint', action: 'report', target: null, note: 'No sprints' },
    ];
  }
  return [
    { kind: 'status', source: 'To Do', action: 'match', target: 'Todo', note: null },
    { kind: 'status', source: 'In Review', action: 'create', target: 'In review', note: null },
    { kind: 'status', source: 'Done', action: 'match', target: 'Done', note: null },
    { kind: 'type', source: 'Bug', action: 'match', target: 'Bug', note: null },
    { kind: 'type', source: 'Incident', action: 'create', target: 'Incident', note: null },
    {
      kind: 'field',
      source: 'Story points (old)',
      action: 'report',
      target: null,
      note: 'Listed in the report; its values are not brought in.',
    },
  ];
}
