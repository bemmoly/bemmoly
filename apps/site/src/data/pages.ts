/**
 * Every indexable page, in one place: the document title and meta description each page
 * renders, its short name (breadcrumbs, llms.txt, footer), and the date its content last
 * changed (the sitemap's lastmod). Bump `updated` when a page's words change, not on every
 * build, so search engines can trust the dates.
 */
import { RELEASE_DATES } from './changelog.ts';

export interface SitePage {
  path: string;
  /** Short name: breadcrumbs, llms.txt and links. */
  name: string;
  /** The whole <title>, 30 to 60 characters. */
  title: string;
  /** The meta description, 70 to 160 characters. */
  description: string;
  /** ISO date the content last changed. The changelog's comes from the newest release. */
  updated: string;
  /** The page is about the software itself, so it carries the SoftwareApplication data. */
  software?: boolean;
}

export const PAGES = [
  {
    path: '/',
    name: 'Bemmoly',
    title: 'Bemmoly: self-hosted, open source project management',
    description:
      'Open source (MIT), self-hosted, AI-first issues and docs for your whole company. One container and one Postgres on your own server, with no per-seat pricing.',
    updated: '2026-10-10',
    software: true,
  },
  {
    path: '/self-hosting',
    name: 'Self-hosting',
    title: 'Self-hosting: install Bemmoly on your own server',
    description:
      'Run Bemmoly on a fresh Linux VM with one command or start from your Docker Compose, Kubernetes, Postgres or offline setup. HTTPS, backups and upgrades built in.',
    updated: '2026-10-10',
    software: true,
  },
  {
    path: '/docs',
    name: 'Docs',
    title: 'Bemmoly docs: install, run and upgrade your own server',
    description:
      'Guides for running Bemmoly on your own server: the one-command install, Docker Compose by hand, backups, upgrades and rollback, and where the design lives.',
    updated: '2026-10-10',
  },
  {
    path: '/changelog',
    name: 'Changelog',
    title: 'Bemmoly changelog: every release and what changed',
    description:
      'Every Bemmoly release, newest first: what changed, and the configuration and schema changes an admin should know before updating. Also available as an RSS feed.',
    updated: Object.values(RELEASE_DATES).sort().at(-1) ?? '2026-10-10',
  },
  {
    path: '/security',
    name: 'Security',
    title: 'Security policy: report a vulnerability in Bemmoly',
    description:
      'How to report a vulnerability in Bemmoly privately, what happens next, and which versions receive security fixes.',
    updated: '2026-10-08',
  },
  {
    path: '/community',
    name: 'Community',
    title: 'Bemmoly community: questions, bug reports and contributing',
    description:
      'Where to ask questions, report bugs and help build Bemmoly, an open source (MIT), self-hosted work platform developed in the open on GitHub.',
    updated: '2026-10-07',
  },
] as const satisfies readonly SitePage[];

export type PagePath = (typeof PAGES)[number]['path'];

export function pageAt(path: PagePath): SitePage {
  const page = PAGES.find((candidate) => candidate.path === path);
  if (!page) throw new Error(`No page at ${path}`);
  return page;
}

/** Home, then each parent that is a page, then the page itself: /docs/install → Docs → Install. */
export function trailOf(path: string): SitePage[] {
  const parts = path.split('/').filter(Boolean);
  const prefixes = ['/', ...parts.map((_, index) => `/${parts.slice(0, index + 1).join('/')}`)];
  return prefixes.flatMap((prefix) => PAGES.filter((page) => page.path === prefix));
}
