import type { IssueType, Priority, StatusCategory } from '@bemmoly/ui';

/** Sample content for the preview, taken from the Board and Doc mocks; it is never saved. */
export interface SampleIssue {
  key: string;
  type: IssueType;
  priority: Priority;
  title: string;
  assignee: string;
  labels: string[];
}

export const SAMPLE_COLUMNS: Array<{ status: StatusCategory; issues: SampleIssue[] }> = [
  {
    status: 'todo',
    issues: [
      issue('PLT-222', 'task', 'medium', 'Rate-limit token refresh endpoint', 'Aisha K.', ['api']),
      issue('PLT-211', 'story', 'medium', 'Session cleanup background job', 'Jonas M.', ['infra']),
    ],
  },
  {
    status: 'progress',
    issues: [
      issue('PLT-218', 'story', 'highest', 'Rotate service tokens on every deploy', 'Priya N.', [
        'auth',
        'security',
      ]),
      issue('PLT-226', 'bug', 'high', 'Refresh token reused after logout on Safari', 'Lena T.', [
        'security',
      ]),
    ],
  },
  {
    status: 'review',
    issues: [
      issue('PLT-204', 'story', 'highest', 'Session store migration to Postgres', 'Aisha K.', [
        'auth',
        'infra',
      ]),
    ],
  },
  {
    status: 'done',
    issues: [
      issue('PLT-198', 'story', 'high', 'SSO with Google Workspace and Okta', 'Priya N.', ['auth']),
      issue('PLT-197', 'task', 'low', 'Auth service CI pipeline', 'Rohan S.', []),
    ],
  },
];

function issue(
  key: string,
  type: IssueType,
  priority: Priority,
  title: string,
  assignee: string,
  labels: string[],
): SampleIssue {
  return { key, type, priority, title, assignee, labels };
}

export const SAMPLE_PAGES = [
  'Engineering handbook',
  'Auth service RFC',
  'Rollout plan',
  'On-call runbook',
  'Postmortems',
];
