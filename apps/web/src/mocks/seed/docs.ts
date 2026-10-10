import { DOCS_BODIES } from './docs-bodies.ts';
import { TEAM_IDS, USER_IDS } from './people.ts';
import { ago, uid } from './time.ts';

/*
 * The Docs side of the Acme Labs workspace, in the shapes the Docs server
 * stores: the spaces of the People mock, a page tree in each with materialized
 * paths and lexorank positions, and the six built-in templates (names only;
 * the documents are the server's). Ids start at 5000 so they never meet
 * another seed's.
 */

export interface MockSpace {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  teamId: string | null;
  projectId: string | null;
  aiExcluded: boolean;
  homePageId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MockPage {
  id: string;
  spaceId: string;
  parentId: string | null;
  position: string;
  path: string;
  title: string;
  icon: string | null;
  status: 'draft' | 'in_review' | 'published' | 'archived';
  ownerId: string | null;
  reviewers: string[];
  templateId: string | null;
  text: string;
  /** The body as the editor stores it; absent pages print `text` as one paragraph. */
  snapshot?: object;
  labels: string[];
  wordCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export const DOCS_SPACE_IDS = {
  eng: uid(5000),
  product: uid(5001),
  handbook: uid(5002),
  design: uid(5003),
} as const;

const space = (
  id: string,
  key: string,
  name: string,
  description: string,
  teamId: string | null,
): MockSpace => ({
  id,
  key,
  name,
  description,
  icon: null,
  color: null,
  teamId,
  projectId: null,
  aiExcluded: false,
  homePageId: null,
  archivedAt: null,
  createdAt: ago(60 * 24 * 40),
  updatedAt: ago(60 * 24 * 2),
});

export function seedDocsSpaces(): MockSpace[] {
  return [
    space(
      DOCS_SPACE_IDS.eng,
      'ENG',
      'Engineering',
      'RFCs, runbooks and postmortems.',
      TEAM_IDS.platform,
    ),
    space(DOCS_SPACE_IDS.product, 'PROD', 'Product', 'Specs, roadmaps and research.', null),
    space(DOCS_SPACE_IDS.handbook, 'HB', 'Company handbook', 'How we work at Acme Labs.', null),
    space(
      DOCS_SPACE_IDS.design,
      'DES',
      'Design',
      'Principles, critiques and the system.',
      TEAM_IDS.design,
    ),
  ];
}

/** [n, space, parent n or null, position, title, status, owner, minutes since edit, text]. */
type PageSeed = readonly [
  number,
  string,
  number | null,
  string,
  string,
  MockPage['status'],
  string,
  number,
  string,
];

const PAGES: readonly PageSeed[] = [
  [
    5100,
    DOCS_SPACE_IDS.eng,
    null,
    'n',
    'Platform',
    'published',
    USER_IDS.priya,
    60 * 30,
    'Everything the platform team owns.',
  ],
  [
    5101,
    DOCS_SPACE_IDS.eng,
    5100,
    'n',
    'RFC: Move sessions to Postgres',
    'in_review',
    USER_IDS.aisha,
    45,
    'Sessions move from Redis to Postgres with a dual-write.',
  ],
  [
    5102,
    DOCS_SPACE_IDS.eng,
    5100,
    't',
    'Auth service runbook',
    'published',
    USER_IDS.jonas,
    60 * 5,
    'What on-call does when login latency climbs.',
  ],
  [
    5103,
    DOCS_SPACE_IDS.eng,
    null,
    't',
    'Postmortems',
    'published',
    USER_IDS.priya,
    60 * 24 * 3,
    'Blameless reviews of every SEV-1 and SEV-2.',
  ],
  [
    5104,
    DOCS_SPACE_IDS.eng,
    5103,
    'n',
    'Postmortem: checkout outage',
    'published',
    USER_IDS.rohan,
    60 * 24,
    'Checkout failed for 38 minutes after a config push.',
  ],
  [
    5105,
    DOCS_SPACE_IDS.product,
    null,
    'n',
    'Q4 roadmap',
    'published',
    USER_IDS.lena,
    60 * 3,
    'What ships this quarter and why.',
  ],
  [
    5106,
    DOCS_SPACE_IDS.product,
    null,
    't',
    'Spec: Docs home',
    'draft',
    USER_IDS.maya,
    20,
    'Spaces, recent pages and what needs attention.',
  ],
  [
    5107,
    DOCS_SPACE_IDS.handbook,
    null,
    'n',
    'Welcome to Acme Labs',
    'published',
    USER_IDS.rohan,
    60 * 24 * 9,
    'Start here on your first day.',
  ],
  [
    5108,
    DOCS_SPACE_IDS.handbook,
    null,
    't',
    'Time off',
    'published',
    USER_IDS.rohan,
    60 * 24 * 20,
    'How to ask for leave and who approves it.',
  ],
  [
    5109,
    DOCS_SPACE_IDS.design,
    null,
    'n',
    'Design principles',
    'published',
    USER_IDS.maya,
    60 * 24 * 6,
    'Calm, fast and every state designed.',
  ],
];

export function seedDocsPages(): MockPage[] {
  const pages: MockPage[] = [];
  for (const [n, spaceId, parent, position, title, status, ownerId, minutes, text] of PAGES) {
    const id = uid(n);
    const parentRow = parent === null ? null : pages.find((row) => row.id === uid(parent));
    pages.push({
      id,
      spaceId,
      parentId: parentRow?.id ?? null,
      position,
      path: `${parentRow?.path ?? '/'}${id}/`,
      title,
      icon: null,
      status,
      ownerId,
      reviewers: status === 'in_review' ? [USER_IDS.jonas] : [],
      templateId: null,
      text,
      ...(DOCS_BODIES[n] ? { snapshot: DOCS_BODIES[n] } : {}),
      labels: title.startsWith('RFC') ? ['rfc'] : [],
      wordCount: text.split(/\s+/).length,
      version: 1,
      createdAt: ago(minutes + 60 * 24 * 7),
      updatedAt: ago(minutes),
      deletedAt: null,
    });
  }
  return pages;
}
