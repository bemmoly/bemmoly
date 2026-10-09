/**
 * /changelog and /changelog.xml are built from the release notes the changesets tool writes
 * into each package's CHANGELOG.md (src/lib/changelog.ts reads them). The notes carry no
 * dates, so the day each version was tagged is listed here; a version missing from this list
 * shows without a date until it is added.
 */
export const RELEASE_DATES: Readonly<Record<string, string>> = {
  '0.2.0': '2026-10-09',
  '0.1.7': '2026-10-09',
  '0.1.6': '2026-10-09',
  '0.1.5': '2026-10-09',
  '0.1.4': '2026-10-08',
  '0.1.3': '2026-10-08',
  '0.1.2': '2026-10-08',
  '0.1.1': '2026-10-08',
  '0.1.0': '2026-10-07',
};

/**
 * What each coming release adds, from the README's status table (tech design §24). Rows for
 * versions already released drop out on their own (UPCOMING in src/lib/changelog.ts).
 */
export const ROADMAP = [
  {
    version: '0.2',
    title: 'Work',
    scope: 'projects, issues, workflows, boards, backlog and sprints, filters, search',
  },
  {
    version: '0.3',
    title: 'Docs',
    scope: 'spaces, the page tree, a collaborative editor, revisions, comments, templates',
  },
  {
    version: '0.4',
    title: 'AI',
    scope: 'summaries, ask-your-docs with citations, the ⌘K palette with plans, any provider',
  },
  {
    version: '0.5',
    title: 'Import and integrations',
    scope: 'importers, OIDC, SAML and SCIM, webhooks, automation, roadmap',
  },
  {
    version: '1.0',
    title: 'Launch',
    scope: 'Helm and Terraform, air-gap bundle, PWA, accessibility and security review',
  },
] as const;
