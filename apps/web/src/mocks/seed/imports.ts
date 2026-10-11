import type { ImportDiscovery, ImportMapping, ImportSource } from '@bemmoly/shared';

/** The sources the server offers, keyed by the module that brings them. */
export const MOCK_IMPORT_SOURCES: readonly ImportSource[] = [
  {
    id: 'jira',
    moduleId: 'work',
    label: 'Jira',
    description:
      'Projects, issues, comments, attachments and people from Jira Cloud or Data Center.',
    brings: ['Projects', 'People', 'Issues', 'Comments', 'Attachments'],
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
        placeholder: 'https://acme.atlassian.net',
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
    fields: [
      {
        name: 'siteUrl',
        label: 'Site address',
        kind: 'url',
        required: true,
        placeholder: 'https://acme.atlassian.net/wiki',
      },
      { name: 'email', label: 'Account email', kind: 'email', required: true },
      { name: 'token', label: 'API token', kind: 'secret', required: true },
    ],
  },
];

export function mockDiscovery(source: string, site: string): ImportDiscovery {
  if (source === 'csv') {
    return {
      site: 'issues.csv',
      containers: [{ id: 'file', key: null, name: 'issues.csv', kind: 'file', count: 214 }],
      counts: { issues: 214 },
      warnings: ['3 rows have no Summary and will be skipped.'],
    };
  }
  if (source === 'confluence') {
    return {
      site,
      containers: [
        { id: 'ENG', key: 'ENG', name: 'Engineering', kind: 'space', count: 412 },
        { id: 'HR', key: 'HR', name: 'People team', kind: 'space', count: 88 },
      ],
      counts: { spaces: 2, pages: 500 },
      warnings: [],
    };
  }
  return {
    site,
    containers: [
      { id: '10001', key: 'PLT', name: 'Platform', kind: 'project', count: 1840 },
      { id: '10002', key: 'SUP', name: 'Support', kind: 'project', count: 622 },
      { id: '10003', key: 'MOB', name: 'Mobile', kind: 'project', count: 307 },
    ],
    counts: { projects: 3, issues: 2769, users: 24 },
    warnings: ['Custom field "Story points (old)" has no match and will be reported.'],
  };
}

export function mockMappings(source: string): ImportMapping[] {
  if (source === 'csv') {
    return [
      { kind: 'field', source: 'Summary', action: 'match', target: 'Title', note: null },
      { kind: 'field', source: 'Status', action: 'match', target: 'Status', note: null },
      { kind: 'field', source: 'Sprint', action: 'report', target: null, note: 'No sprints' },
      { kind: 'person', source: 'ana@acme.dev', action: 'match', target: 'Ana Costa', note: null },
    ];
  }
  return [
    { kind: 'status', source: 'To Do', action: 'match', target: 'Todo', note: null },
    { kind: 'status', source: 'In Review', action: 'create', target: 'In review', note: null },
    { kind: 'person', source: 'rohan@acmelabs.dev', action: 'match', target: 'Rohan', note: null },
    { kind: 'person', source: 'old.contractor', action: 'report', target: null, note: 'Left' },
    { kind: 'field', source: 'Story points (old)', action: 'report', target: null, note: null },
  ];
}
