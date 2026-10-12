/**
 * Facts shown on /self-hosting, from tech design §18 and what the deploy work ships for this
 * release. Every badge on the page comes from STATUS, so the page cannot claim more than
 * these say: a way to run it is either available in this release or coming soon, with no
 * date or version.
 */
import type { BadgeTone } from '../lib/badge.ts';
import { INSTALL_COMMAND } from '../lib/links.ts';
import { CAPACITY, fmt, isMeasured, peopleOf, sizeKey, sizeName } from './capacity.ts';
import { RELEASE } from './landing.ts';
import { fromOffer, offerMoney } from './prices.ts';

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

/**
 * Every listed server size in one line each, from capacity.json and prices.json with the
 * sizing card's honesty rules: a size with no runs says "not yet measured" and carries no
 * number; a measured size names the largest data set it handled, the people estimate only
 * from a measured load (labelled as an estimate) and its cheapest confirmed price.
 * tests/capacity.test.ts checks the agent prompt's numbers against the data.
 */
export const SIZING = CAPACITY.sizes.map((size) => {
  const name = sizeName(size);
  if (!isMeasured(size)) return { vm: name, line: `${name}: not yet measured` };
  const top = [...size.runs]
    .filter((run) => run.verdict !== 'slow')
    .sort((a, b) => b.data.issues - a.data.issues)[0]!;
  const load = size.runs.find((run) => run.requestsPerSecond !== null);
  const people = load ? peopleOf(load.requestsPerSecond) : null;
  const from = fromOffer(sizeKey(size));
  const parts = [
    `measured with ${top.data.approximate ? 'about ' : ''}${fmt(top.data.issues)} issues`,
    people && load
      ? `about ${fmt(people.atOnce)} people active at once (an estimate, from the ${fmt(load.data.issues)}-issue run)`
      : '',
    from ? `from ${offerMoney(from)} a month at ${from.provider.provider}` : '',
  ].filter(Boolean);
  return { vm: name, line: `${name}: ${parts.join(', ')}` };
});
