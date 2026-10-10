/**
 * The claims a sceptic would doubt, each with the file that makes it true. Where a claim rests
 * on one line of code, `file` and `quote` name it and tests/promises.test.ts fails the build
 * the day that file loses the line, so the site cannot go on saying it.
 */
import type { SiteIconName } from '../lib/icons.ts';
import { REPO_URL, sourceUrl } from '../lib/links.ts';

export interface Proof {
  /** The link text: a path, a screen or a short fact. */
  label: string;
  /** What it shows, after the link. */
  note: string;
  href: string;
  /** A repository file and a line it contains, verbatim. */
  file?: string;
  quote?: string;
}

const inFile = (file: string, quote: string, label: string, note: string): Proof => ({
  label,
  note,
  href: sourceUrl(file),
  file,
  quote,
});

export interface DealPromise {
  id: string;
  icon: SiteIconName;
  title: string;
  body: string;
  proofs: readonly Proof[];
}

/** Keerthi's three differentiators, in his order and his words: the spine of the homepage. */
export const PROMISES: readonly DealPromise[] = [
  {
    id: 'open',
    icon: 'git',
    title: '100% open source',
    body: 'MIT licensed. Every feature is in the public repository: no open core, no enterprise edition, no private modules.',
    proofs: [
      inFile(
        'LICENSE',
        'Copyright (c) 2026 Bemmoly contributors',
        'LICENSE',
        'MIT, “Bemmoly contributors”',
      ),
      {
        label: 'github.com/bemmoly/bemmoly',
        note: 'every module and the image you install are built from it',
        href: REPO_URL,
      },
    ],
  },
  {
    id: 'free',
    icon: 'infinity',
    title: 'No pricing',
    body: 'No plans, tiers, seat limits or trial clock. Free forever, with nothing to upgrade to. Your only bill is the server.',
    proofs: [
      inFile(
        'apps/web/src/hooks/use-users.ts',
        'no seat limit, self-hosted',
        'Settings › Users',
        '“no seat limit, self-hosted”',
      ),
      {
        label: 'A 2 vCPU, 4 GB VM',
        note: 'roughly $5–25 a month',
        href: '/docs/install#requirements',
      },
    ],
  },
  {
    id: 'nothing-to-buy',
    icon: 'bag-off',
    title: 'No in-app purchases',
    body: 'No paywalled features, no upsell banners, no “contact sales”. Every switch in Settings is yours to flip.',
    proofs: [
      { label: 'No licence key', note: 'or plan check anywhere in the code', href: REPO_URL },
      inFile(
        'packages/core/src/models/modules.ts',
        "enabled: boolean('enabled').notNull().default(false)",
        'Modules',
        'turned on by your admin, not a payment',
      ),
    ],
  },
];

export interface OwnFact {
  icon: SiteIconName;
  title: string;
  body: string;
  proof: Proof;
  /** Only for what is not proven yet: amber, never green. */
  untested?: string;
}

/** "Yours to run": what self-hosting means in practice, each fact with its file. */
export const OWN: readonly OwnFact[] = [
  {
    icon: 'server',
    title: 'One VM, one Postgres',
    body: 'One app image beside Postgres 18. No Redis, no search cluster. 2 vCPU and 4 GB is the size we plan for about 200 people.',
    proof: inFile(
      'docs/adr/0011-postgres-only.md',
      'Postgres is the only database',
      'docs/adr/0011-postgres-only.md',
      '',
    ),
  },
  {
    icon: 'user-x',
    title: 'No account with us',
    body: 'The installer comes from GitHub Releases and checks its SHA-256. Your first admin is created on your server, not ours.',
    proof: inFile('deploy/install.sh', 'checks its SHA-256', 'deploy/install.sh', ''),
  },
  {
    icon: 'eye-off',
    title: 'Nothing phones home',
    body: 'No telemetry. The check for new releases is off until an admin turns it on in Settings › Updates.',
    proof: inFile(
      'packages/core/src/services/system/settings.ts',
      "{ key: 'system.updates.check', schema: z.boolean(), default: false }",
      'packages/…/system/settings.ts',
      '',
    ),
  },
  {
    icon: 'database',
    title: 'Backups built in',
    body: 'Every night at 02:00, kept 7 days, 4 weeks and 3 months, with a weekly test restore. Restore from the app or one command.',
    proof: inFile(
      'packages/shared/src/schemas/system/backups.ts',
      "testRestore: z.enum(['weekly', 'off']).default('weekly')",
      'packages/…/system/backups.ts',
      '',
    ),
  },
  {
    icon: 'refresh',
    title: 'Signed, reversible updates',
    body: 'Images are signed. An update backs up first, checks the signature and rolls itself back if the app is not healthy within three minutes.',
    proof: inFile(
      'deploy/updater/src/services/update.ts',
      'verify signature',
      'deploy/updater/…/update.ts',
      '',
    ),
  },
  {
    icon: 'wifi-off',
    title: 'Runs without the internet',
    body: 'Each release ships an offline bundle with the images, the installer and checksums. Docker must already be on the machine.',
    proof: inFile(
      'deploy/scripts/airgap-bundle.sh',
      'bemmoly-airgap-',
      'deploy/scripts/airgap-bundle.sh',
      '',
    ),
    untested: 'Built, untested offline',
  },
];

/** The line under the promises: what keeps it yours, each verified in the code. */
export const YOURS: readonly { icon: SiteIconName; label: string }[] = [
  { icon: 'user-x', label: 'No account with us' },
  { icon: 'eye-off', label: 'No telemetry' },
  { icon: 'bell', label: 'Release check off until you turn it on' },
  { icon: 'export', label: 'Pages export as Markdown or HTML' },
];
