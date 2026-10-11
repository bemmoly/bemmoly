/**
 * Copy for the homepage, from the site design review (docs/design-review, Proposed). Every
 * fact here is true of the release the installer pulls today; versions come from the build
 * (src/lib/changelog.ts) and nothing unreleased carries one. The claims with a file behind
 * them live in proofs.ts; the questions in faq.ts.
 */
import { LATEST, shippedIn } from '../lib/changelog.ts';
import type { SiteIconName } from '../lib/icons.ts';
import { INSTALL_COMMAND } from '../lib/links.ts';
import { RELEASE_TITLES } from './changelog.ts';
import { COMPOSE_EDIT, COMPOSE_FILES, COMPOSE_START } from './compose.ts';

const LATEST_TITLE = RELEASE_TITLES[LATEST.version];

/** The newest release, from the release notes, and what it brought (src/data/changelog.ts). */
export const RELEASE = {
  version: LATEST.version,
  note: LATEST_TITLE?.title ?? `Bemmoly ${LATEST.version}`,
  short: LATEST_TITLE?.short ?? LATEST_TITLE?.title ?? `Bemmoly ${LATEST.version}`,
};

export const INSTALL = INSTALL_COMMAND;

/** The three promises under the hero, word for word, each linking to its proof. */
export const HERO_TICKS = [
  { label: '100% open source, MIT', href: '/#promise-open' },
  { label: 'No subscription, no seat limits', href: '/#promise-free' },
  { label: 'No in-app purchases', href: '/#promise-nothing-to-buy' },
] as const;

export interface Outcome {
  lead: string;
  rest: string;
}

/** Work, as four outcomes, from the Work module's release notes. */
export const WORK_OUTCOMES: readonly Outcome[] = [
  { lead: 'Scrum or Kanban', rest: 'per project, with epics as swimlanes and WIP limits' },
  { lead: 'Your workflow', rest: 'drawn in a visual editor, with conditions and post-actions' },
  { lead: 'Find anything', rest: 'with a query language, saved filters and the command palette' },
  { lead: 'Configure, then lock', rest: 'org defaults, project overrides and custom roles' },
  { lead: 'A roadmap', rest: 'epics on a timeline, with a forecast from your team’s own pace' },
  { lead: 'Automation rules', rest: 'a trigger, conditions in LQL, then the actions to take' },
];

/** Docs, from the 0.3 release notes: shipped, nothing planned. */
export const DOCS_OUTCOMES: readonly Outcome[] = [
  { lead: 'Write together', rest: 'live, with named cursors; offline edits merge on return' },
  { lead: 'Comments that stay put', rest: 'they follow their words through later edits' },
  { lead: 'History you can trust', rest: 'compare any two versions block by block, restore one' },
  { lead: 'Issues inside the page', rest: 'chips and tables with each issue’s live status' },
];

/** What AI does in the release that shipped it, from its release notes (apps/web 0.5.0). */
export const AI_FEATURES: readonly Outcome[] = [
  {
    lead: 'Summaries that cite their sources',
    rest: 'on issues, pages, a sprint at risk and your morning brief',
  },
  { lead: 'Ask your docs', rest: 'answers with numbered citations, from pages you can open' },
  { lead: 'Help in the editor', rest: 'nothing reaches a shared page until someone accepts it' },
  { lead: 'Plans you confirm', rest: 'from ⌘K, each change checked against your permissions' },
];

/** The installer's transcript (deploy/installer), Postgres 18 and this release's version. */
export const TRANSCRIPT: readonly { text: string; tone: 'step' | 'done' }[] = [
  { text: '→ Detected Ubuntu 24.04, 2 vCPU, 4 GB', tone: 'step' },
  { text: '→ Installing Postgres 18 (pgvector) … done', tone: 'step' },
  { text: `→ Pulling bemmoly:${RELEASE.version} … done`, tone: 'step' },
  { text: '→ Requesting certificate for bemmoly.acmelabs.dev … done', tone: 'step' },
  { text: '→ Nightly backup scheduled 02:00 → /var/bemmoly/backups', tone: 'step' },
  { text: '✓ Bemmoly is running at https://bemmoly.acmelabs.dev', tone: 'done' },
  { text: '  Open it to create the first admin.', tone: 'done' },
];

export interface InstallStep {
  /** Commands with $ prompts; only the commands are copied. */
  code: string;
  label: string;
  note?: string;
}

export interface InstallPath {
  id: string;
  title: string;
  badge?: { label: string; tone: 'accent' };
  steps: readonly InstallStep[];
  note: string;
}

/**
 * Where you install, as tabs. Multi-step paths copy step by step where order matters, so a
 * Compose stack never starts before .env is filled in. Only paths that are shipped and tested
 * get a tab.
 */
export const INSTALL_PATHS: readonly InstallPath[] = [
  {
    id: 'vm',
    title: 'Fresh VM',
    badge: { label: 'Recommended', tone: 'accent' },
    steps: [{ code: `$ ${INSTALL_COMMAND}`, label: 'On the VM, as root or with sudo' }],
    note: 'Installs Docker if it is missing, then Postgres 18, HTTPS, nightly backups and the updater.',
  },
  {
    id: 'compose',
    title: 'Docker Compose',
    steps: [
      { code: COMPOSE_FILES, label: '1. Put the files in /var/bemmoly' },
      {
        code: COMPOSE_EDIT,
        label: '2. Fill in .env',
        note: 'Replace every @…@ placeholder: the version, your domain, the profiles to run and the secrets. The Docker Compose guide lists each value.',
      },
      { code: COMPOSE_START, label: '3. Start it, once .env is filled in' },
    ],
    note: 'The same files the installer writes. The bemmoly command comes only with the one-command install.',
  },
  {
    id: 'postgres',
    title: 'Your own Postgres',
    steps: [
      {
        code: `$ curl -fsSL https://get.bemmoly.com | sh -s -- \\\n    --database-url postgres://bemmoly:PASSWORD@db.internal:5432/bemmoly_db`,
        label: 'On the VM, with your database’s address',
      },
    ],
    note: 'Replace PASSWORD first. Your database must be Postgres 18 with the pgvector extension.',
  },
];

/** What the installer does, from its own code (deploy/installer/lib). */
export const INSTALLER_STEPS: readonly Outcome[] = [
  {
    lead: 'Checks the machine',
    rest: 'system, memory, disk, ports and DNS, and prints the fix for anything missing',
  },
  { lead: 'Installs what is missing', rest: 'Docker Engine and the Compose plugin, or uses yours' },
  {
    lead: 'Writes /var/bemmoly',
    rest: 'the Compose file, a .env with fresh secrets, data and backups',
  },
  { lead: 'Starts and secures it', rest: 'Postgres, the app and a certificate for your domain' },
  { lead: 'Prints your address', rest: 'open it to create the first admin' },
];

export interface SwitchTile {
  icon: SiteIconName;
  title: string;
  body: string;
  soon?: boolean;
}

/** Bringing work in and taking it out. Other products are named only as import sources. */
export const SWITCH_TILES: readonly SwitchTile[] = [
  {
    icon: 'import',
    title: 'Import from Jira',
    body: 'Projects, issues, comments, attachments, boards and sprints from Cloud or Data Center, or issues from a CSV file.',
  },
  {
    icon: 'import',
    title: 'Import from Confluence',
    body: 'Spaces, page trees, comments and attachments from Cloud or Data Center, or a space export.',
  },
  {
    icon: 'doc',
    title: 'Markdown files and folders',
    body: 'Drop a folder; its folders become parent pages.',
  },
  {
    icon: 'export',
    title: 'Export, any time',
    body: shippedIn('Docs pages export to PDF')
      ? 'A page as Markdown or HTML, or a page and its subpages as a zip; PDF from the optional renderer or your browser.'
      : 'A page as Markdown or HTML, or a page and its subpages as a zip; PDF through your browser.',
  },
];

/** Configuration, compressed to one strip; the detail lives on the topic pages. */
export const CONFIGURE: readonly { icon: SiteIconName; title: string; body: string }[] = [
  { icon: 'flow', title: 'Workflows', body: 'statuses and transitions per project' },
  { icon: 'sliders', title: 'Issue types and fields', body: 'org defaults, project overrides' },
  { icon: 'lock', title: 'Roles', body: 'five built in, plus your own, with org locks' },
  {
    icon: 'palette',
    title: 'Themes',
    body: 'five themes in light and dark, your brand colour and your logo',
  },
];

/** What it connects to, from the release notes that shipped each (0.6, 0.7 and 0.13). */
export const CONNECT: readonly { icon: SiteIconName; title: string; body: string }[] = [
  { icon: 'shield', title: 'Single sign-on', body: 'OpenID Connect or SAML, and SCIM 2.0' },
  { icon: 'zap', title: 'Webhooks', body: 'signed with HMAC-SHA256, with a delivery log' },
  {
    icon: 'pull-request',
    title: 'Code hosts',
    body: shippedIn('Connect GitHub in one click')
      ? 'GitHub in one click, or GitLab: pull requests on the issue'
      : 'GitHub or GitLab: pull requests on the issue',
  },
  { icon: 'puzzle', title: 'An MCP server', body: 'AI clients work as you, with your permissions' },
];
