/**
 * Facts shown on /self-hosting, from tech design §18 and what the deploy work ships for this
 * release. Every badge on the page comes from STATUS, so the page cannot claim more than
 * these say: a way to run it is either available in this release or coming soon, with no
 * date or version.
 */
import type { BadgeTone } from '../lib/badge.ts';
import { INSTALL_COMMAND } from '../lib/links.ts';
import { RELEASE } from './landing.ts';

export const STATUS = {
  available: { label: `Available in ${RELEASE.version}`, tone: 'ok' },
  soon: { label: 'Coming soon', tone: 'neutral' },
} as const satisfies Record<string, { label: string; tone: BadgeTone }>;

export type StatusKey = keyof typeof STATUS;

export const INSTALL_BLOCK = `$ ${INSTALL_COMMAND}`;

/** The three things to have before running the installer (deploy/installer/lib/preflight.sh). */
export const REQUIREMENTS = [
  'A Linux VM with at least 1 vCPU and 2 GB of memory, and 10 GB of free disk',
  'Ubuntu 22.04+, Debian 12+, Fedora 40+ or Amazon Linux 2023',
  'A domain pointing at it, and ports 80 and 443 free',
];

/** The same on every path. */
export const WHAT_YOU_GET = [
  { title: 'Automatic HTTPS', body: 'Certificates are requested and renewed for you.' },
  { title: 'Nightly backups', body: 'Kept 7 days, 4 weeks and 3 months, and verified.' },
  {
    title: 'Upgrades with rollback',
    body: 'A failed health check rolls back on its own; you can roll back for 7 days.',
  },
  { title: 'In-app updater', body: 'Release notes, then one click to update.' },
  { title: 'All modules', body: 'Every module ships in the one image. Turn on what you use.' },
];

/** Tech design §18's planning figures: estimates until a load test measures them. */
export const SIZING = [
  { team: 'Up to 50 people', vm: '1 vCPU, 2 GB', note: 'The installer’s minimum memory.' },
  {
    team: 'Up to 200 people',
    vm: '2 vCPU, 4 GB',
    note: 'The size the design plans for on one VM, with headroom for imports.',
  },
  {
    team: 'Up to 1,000 people',
    vm: '4 vCPU, 8 GB',
    note: 'Or split the api and worker roles, with Postgres on its own machine and attachments in an S3-compatible bucket.',
  },
  {
    team: 'Beyond',
    vm: 'Kubernetes',
    note: 'The Helm chart, with its own Postgres or yours; live collaboration needs one app replica for now.',
    status: 'available' as StatusKey,
  },
];
