/**
 * /changelog and /changelog.xml are built from the release notes the changesets tool writes
 * into each package's CHANGELOG.md (src/lib/changelog.ts reads them). The notes carry no
 * dates, so the day each version was tagged is listed here; a version missing from this list
 * shows without a date until it is added.
 */
export const RELEASE_DATES: Readonly<Record<string, string>> = {
  '0.7.0': '2026-10-11',
  '0.6.0': '2026-10-11',
  '0.5.0': '2026-10-11',
  '0.4.0': '2026-10-10',
  '0.3.0': '2026-10-10',
  '0.2.2': '2026-10-10',
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
 * A title and one line for the releases the homepage lists under "Recent releases", in the
 * words of their notes. A release without an entry here is listed by its first note instead.
 */
export const RELEASE_TITLES: Readonly<
  Record<string, { title: string; summary: string; short?: string }>
> = {
  '0.7.0': {
    title: 'Imports and single sign-on',
    short: 'Imports and SSO',
    summary: 'Import from Jira and Confluence, or from CSV, plus OIDC, SAML and SCIM',
  },
  '0.6.0': {
    title: 'Image uploads, an MCP server and an updater that updates itself',
    summary:
      'Images uploaded into docs, MCP for AI clients, and updates that keep the updater current',
  },
  '0.5.0': {
    title: 'AI arrives, and it is optional',
    summary: 'Summaries with sources, answers from your docs, editor help and plans you confirm',
  },
  '0.4.0': {
    title: 'A quieter, premium look',
    summary: 'One sidebar for Work and Docs, the logo’s colours, drawn icons and a new setup',
  },
  '0.3.0': {
    title: 'Docs arrives',
    summary: 'Spaces, a live editor, comments, history, import and export',
  },
  '0.2.0': {
    title: 'Work ships in the image',
    summary: 'Projects, workflows, boards, the backlog and sprints',
  },
};

/**
 * What has shipped that the site once listed as coming soon, with the release that brought it
 * and the words its release notes use. tests/claims.test.ts checks each against those notes and
 * fails the build if any page puts one of these terms next to "Coming soon".
 */
export const SHIPPED = [
  { title: 'Import from Jira', since: '0.7.0', terms: ['Jira'] },
  { title: 'Import from Confluence', since: '0.7.0', terms: ['Confluence'] },
  { title: 'CSV import', since: '0.7.0', terms: ['CSV'] },
  { title: 'Single sign-on', since: '0.7.0', terms: ['single sign-on', 'OpenID Connect', 'SAML'] },
  { title: 'SCIM provisioning', since: '0.7.0', terms: ['SCIM'] },
  { title: 'Image uploads in Docs', since: '0.6.0', terms: ['upload'] },
  { title: 'An MCP server', since: '0.6.0', terms: ['MCP'] },
  { title: 'Webhooks and automation', since: '0.13.0', terms: ['webhook'] },
  { title: 'A roadmap view', since: '0.13.0', terms: ['roadmap'] },
  { title: 'Kubernetes and Terraform', since: '0.13.0', terms: ['Terraform', 'Helm chart'] },
] as const;

/** Words for the shipped items that the notes spell differently, still never "Coming soon". */
export const SHIPPED_ALIASES = ['OIDC', 'SSO'] as const;

/**
 * What is coming soon, with no dates or release numbers: a version promised for unbuilt work
 * becomes false the day plans move. Worded as every page words it. A row leaves this list in
 * the change that ships it; `terms` are the words its release note will use, and the claims
 * test fails while a release note already uses them.
 */
export const ROADMAP = [
  {
    title: 'An installable app',
    scope: 'Bemmoly on your home screen, with web push notifications',
    terms: ['web push'],
  },
] as const;
