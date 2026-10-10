/**
 * Facts shown on /self-hosting, from tech design §18 and what the deploy work ships for this
 * release. Every badge on the page comes from STATUS, so the page cannot claim more than
 * these say.
 */
import type { BadgeTone } from '../lib/badge.ts';
import { INSTALL_COMMAND } from '../lib/links.ts';
import { RELEASE } from './landing.ts';

export const STATUS = {
  available: { label: `available in ${RELEASE.version}`, tone: 'ok' },
  ubuntu: { label: 'tested on Ubuntu', tone: 'accent' },
  offline: { label: 'built, untested offline', tone: 'warn' },
  launch: { label: 'planned for 1.0', tone: 'neutral' },
} as const satisfies Record<string, { label: string; tone: BadgeTone }>;

export type StatusKey = keyof typeof STATUS;

export const INSTALL_BLOCK = `$ ${INSTALL_COMMAND}`;

/** The three things to have before running the installer. */
export const REQUIREMENTS = [
  'A VM with 2 vCPU and 4 GB',
  'Ubuntu, Debian, Fedora or Amazon Linux',
  'A domain pointing at it',
];

/** The same on every path. */
export const WHAT_YOU_GET = [
  { title: 'Automatic HTTPS', body: 'Certificates are requested and renewed for you.' },
  { title: 'Nightly backups', body: 'Kept 7 days, 4 weeks and 3 months, and verified.' },
  {
    title: 'One-command upgrades and rollback',
    body: 'A failed health check rolls back on its own; you can roll back for 7 days.',
  },
  { title: 'In-app updater', body: 'Release notes, then one click to update.' },
  { title: 'All modules', body: 'Every module ships in the one image. Turn on what you use.' },
];

export const SIZING = [
  {
    team: 'Up to 50 people',
    vm: '1 vCPU, 2 GB',
    note: 'Comfortable; AI jobs run one at a time.',
  },
  {
    team: 'Up to 200 people',
    vm: '2 vCPU, 4 GB',
    note: 'The size we promise on one VM: the app uses about 400 MB, Postgres about 1 GB, and the rest is headroom for imports.',
  },
  {
    team: 'Up to 1,000 people',
    vm: '4 vCPU, 8 GB',
    note: 'Or split the api and worker roles, with Postgres on its own machine and attachments in an S3-compatible bucket.',
  },
  {
    team: 'Beyond',
    vm: 'Helm',
    note: 'Several replicas and a managed Postgres with a read replica.',
    status: 'launch' as StatusKey,
  },
];
