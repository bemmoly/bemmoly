/**
 * Copy for the homepage, from the site design review (docs/design-review, Proposed). Every
 * fact here is true of the release the installer pulls today; versions come from the build
 * (src/lib/changelog.ts) and nothing unreleased carries one. The claims with a file behind
 * them live in proofs.ts; the questions in faq.ts.
 */
import { LATEST } from '../lib/changelog.ts';
import type { SiteIconName } from '../lib/icons.ts';
import { INSTALL_COMMAND, REPO_URL } from '../lib/links.ts';

/** The newest release, from the release notes, and what it brought. */
export const RELEASE = {
  version: LATEST.version,
  note: 'The new look is here, and so is Docs',
  short: 'The new look',
};

export const INSTALL = INSTALL_COMMAND;

/** The three promises under the hero, word for word, each linking to its proof. */
export const HERO_TICKS = [
  { label: '100% open source, MIT', href: '/#promise-open' },
  { label: 'No pricing, no seat limits', href: '/#promise-free' },
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
];

/** Docs, from the 0.3 release notes: shipped, nothing planned. */
export const DOCS_OUTCOMES: readonly Outcome[] = [
  { lead: 'Write together', rest: 'live, with named cursors; offline edits merge on return' },
  { lead: 'Comments that stay put', rest: 'they follow their words through later edits' },
  { lead: 'History you can trust', rest: 'compare any two versions block by block, restore one' },
  { lead: 'Issues inside the page', rest: 'chips and tables with each issue’s live status' },
];

/** What AI is designed to do; badged "Designed", never a version, until a release ships it. */
export const AI_DESIGNED: readonly Outcome[] = [
  { lead: 'Summaries that cite their sources', rest: 'the comments and pages they came from' },
  { lead: 'Ask your docs', rest: 'answers with links to the paragraphs' },
  { lead: 'Plans you read first', rest: 'the palette shows what will change, then asks' },
];

/** The installer's transcript (deploy/installer), Postgres 18 and this release's version. */
export const TRANSCRIPT: readonly { text: string; tone: 'step' | 'done' }[] = [
  { text: '→ Detected Ubuntu 24.04, 2 vCPU, 4 GB', tone: 'step' },
  { text: '→ Installing Postgres 18 … done', tone: 'step' },
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
  badge?: { label: string; tone: 'accent' | 'warn' };
  steps: readonly InstallStep[];
  note: string;
}

const BUNDLE = `bemmoly-airgap-${RELEASE.version}-amd64`;

/**
 * Where you install, as tabs. Multi-step paths copy step by step where order matters, so a
 * Compose stack never starts before .env is filled in.
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
      {
        code: `$ git clone --depth 1 ${REPO_URL}\n$ cd bemmoly/deploy/compose && cp env.template .env`,
        label: '1. Get the Compose file',
        note: 'Then fill in .env: the version, your domain, the profiles to run and the secrets it lists.',
      },
      { code: '$ docker compose up -d', label: '2. Start it' },
    ],
    note: 'The same Compose file the installer writes; the Docker Compose guide explains every setting.',
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
    note: 'Replace PASSWORD first. Postgres 18 with pgvector; 17 works with a warning.',
  },
  {
    id: 'offline',
    title: 'Offline bundle',
    badge: { label: 'Untested offline', tone: 'warn' },
    steps: [
      {
        code: `$ tar -xzf ${BUNDLE}.tar.gz\n$ cd ${BUNDLE}\n$ sudo sh install.sh --version ${RELEASE.version} \\\n    --image-archive images.tar --domain bemmoly.internal`,
        label: 'On the machine, after copying the bundle to it',
      },
    ],
    note: 'Docker must already be on the machine. Built for every release, not yet tested offline.',
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
  planned?: boolean;
}

/** Bringing work in and taking it out. Other products are named only as import sources. */
export const SWITCH_TILES: readonly SwitchTile[] = [
  {
    icon: 'import',
    title: 'Import from Confluence',
    body: 'Space exports up to 10 MB, with unknown macros kept as labelled blocks.',
  },
  {
    icon: 'doc',
    title: 'Markdown files and folders',
    body: 'Drop a folder; its folders become parent pages.',
  },
  {
    icon: 'import',
    title: 'Import from Jira',
    body: 'On the roadmap, with the other importers.',
    planned: true,
  },
  {
    icon: 'export',
    title: 'Export, any time',
    body: 'A page as Markdown or HTML, or a page and its subpages as a zip.',
  },
];

/** Configuration, compressed to one strip; the detail lives on the topic pages. */
export const CONFIGURE: readonly { icon: SiteIconName; title: string; body: string }[] = [
  { icon: 'flow', title: 'Workflows', body: 'statuses and transitions per project' },
  { icon: 'sliders', title: 'Issue types and fields', body: 'org defaults, project overrides' },
  { icon: 'lock', title: 'Roles', body: 'five built in, plus your own, with org locks' },
  { icon: 'palette', title: 'Themes', body: 'eight presets and your brand colour' },
];
