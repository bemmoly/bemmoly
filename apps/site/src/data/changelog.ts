/**
 * /changelog and /changelog.xml are built from the release notes the changesets tool writes
 * into each package's CHANGELOG.md (src/lib/changelog.ts reads them). The notes carry no
 * dates, so the day each version was tagged is listed here; a version missing from this list
 * shows without a date until it is added.
 */
export const RELEASE_DATES: Readonly<Record<string, string>> = {
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
export const RELEASE_TITLES: Readonly<Record<string, { title: string; summary: string }>> = {
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
 * What is coming soon, with no dates or release numbers: a version promised for unbuilt work
 * becomes false the day plans move. Worded as every page words it. A row leaves this list in
 * the change that ships it.
 */
export const ROADMAP = [
  { title: 'Import from Jira', scope: 'bring projects and issues across, and CSV files too' },
  { title: 'Single sign-on', scope: 'OIDC, SAML and SCIM' },
  { title: 'Webhooks and automation', scope: 'rules that act on events or a schedule' },
  { title: 'A roadmap view', scope: 'epics on a timeline' },
  { title: 'Kubernetes and Terraform', scope: 'a Helm chart, and modules that create the VM' },
] as const;
