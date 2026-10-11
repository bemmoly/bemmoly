import type {
  CodeCheckState,
  CodeHost,
  CodeHostDelivery,
  CodeHostKind,
  CodeLinkKind,
  CodeLinkState,
  CodeReviewState,
} from '@bemmoly/shared';
import { ago } from './time.ts';

/** Work's code link, as GET /work/issues/:key/code-links answers (the shell names no module). */
export interface CodeLink {
  id: string;
  kind: CodeLinkKind;
  hostKind: CodeHostKind;
  repository: string;
  ref: string;
  title: string;
  url: string;
  state: CodeLinkState | null;
  checks: CodeCheckState | null;
  review: CodeReviewState | null;
  author: string | null;
  updatedAt: string;
}

export interface CodeTransitions {
  pullRequestOpened: string | null;
  pullRequestMerged: string | null;
}

/** Code hosts in the mock: the hosts, their delivery logs, links by issue key, moves by project. */
export interface MockCodeHosts {
  hosts: CodeHost[];
  deliveries: Record<string, CodeHostDelivery[]>;
  links: Record<string, CodeLink[]>;
  transitions: Record<string, CodeTransitions>;
}

const HOST_ID = '0199a000-0000-7000-8000-00000000c0d1';
export const MOCK_WEBHOOK_ORIGIN = 'http://localhost:5173';

const delivery = (
  n: number,
  minutes: number,
  event: string,
  summary: string,
  outcome: CodeHostDelivery['outcome'] = 'processed',
): CodeHostDelivery => ({
  id: `0199a000-0000-7000-8000-0000000d${String(n).padStart(4, '0')}`,
  event,
  action: null,
  outcome,
  summary,
  error: null,
  receivedAt: ago(minutes),
});

const link = (
  n: number,
  fields: Pick<CodeLink, 'kind' | 'ref' | 'title' | 'url'> & Partial<CodeLink>,
): CodeLink => ({
  id: `0199a000-0000-7000-8000-0000000e${String(n).padStart(4, '0')}`,
  hostKind: 'github',
  repository: 'acme/api',
  state: null,
  checks: null,
  review: null,
  author: null,
  updatedAt: ago(n * 90),
  ...fields,
});

const REPO = 'https://github.com/acme/api';

/**
 * The Acme Labs sample, as the Issue mock's Development card draws it: PLT-204 has #4821 in
 * review and #4790 merged, and the branch they come from.
 */
export function seedCodeHosts(withHost: boolean): MockCodeHosts {
  if (!withHost) return { hosts: [], deliveries: {}, links: {}, transitions: {} };
  const deliveries = [
    delivery(
      1,
      42,
      'pull_request_review',
      'Pull request #4821 approved in acme/api · 1 link updated',
    ),
    delivery(2, 180, 'check_suite', 'Checks passing in acme/api · 1 link updated'),
    delivery(
      3,
      1440,
      'push',
      '1 commit pushed to feat/plt-204-pg-sessions in acme/api · 2 links updated',
    ),
    delivery(4, 2880, 'star', 'star is not used by Bemmoly', 'ignored'),
  ];
  return {
    hosts: [
      {
        id: HOST_ID,
        kind: 'github',
        name: 'Acme GitHub',
        baseUrl: null,
        webhookUrl: `${MOCK_WEBHOOK_ORIGIN}/api/v1/code-hosts/${HOST_ID}/webhooks`,
        authMode: 'app',
        appId: '412345',
        installationId: '51234567',
        hasCredentials: true,
        hasWebhookSecret: true,
        repositories: ['acme/api', 'acme/web'],
        enabled: true,
        lastDelivery: deliveries[0] ?? null,
        lastError: null,
        createdAt: ago(60 * 24 * 20),
        updatedAt: ago(60 * 24 * 20),
      },
    ],
    deliveries: { [HOST_ID]: deliveries },
    links: {
      'PLT-204': [
        link(1, {
          kind: 'pull_request',
          ref: '#4821',
          title: 'Session store to Postgres',
          url: `${REPO}/pull/4821`,
          state: 'open',
          checks: 'passing',
          review: 'review_required',
          author: 'aisha-k',
        }),
        link(2, {
          kind: 'pull_request',
          ref: '#4790',
          title: 'Dual-write sessions',
          url: `${REPO}/pull/4790`,
          state: 'merged',
          checks: 'passing',
          review: 'approved',
          author: 'aisha-k',
        }),
        link(3, {
          kind: 'branch',
          ref: 'feat/plt-204-pg-sessions',
          title: 'feat/plt-204-pg-sessions',
          url: `${REPO}/tree/feat/plt-204-pg-sessions`,
        }),
        link(4, {
          kind: 'commit',
          ref: 'a1b2c3d',
          title: 'Backfill sessions in batches of 10k (PLT-204)',
          url: `${REPO}/commit/a1b2c3d`,
          author: 'aisha-k',
        }),
      ],
    },
    transitions: {},
  };
}
