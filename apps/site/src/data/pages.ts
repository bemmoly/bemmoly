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
    path: '/self-hosted-project-management',
    name: 'Self-hosted project management',
    title: 'Self-hosted project management, open source · Bemmoly',
    description:
      'Project management you run on your own server: issues, boards, sprints and docs in one MIT-licensed app, one container and one Postgres, with no per-seat fees.',
    updated: '2026-10-10',
    software: true,
  },
  {
    path: '/open-source-issue-tracker',
    name: 'Issue tracker',
    title: 'Open source issue tracker you host yourself · Bemmoly',
    description:
      'An MIT-licensed issue tracker for your own server: issue types, custom fields, visual workflows, a query language, saved filters and the history of every issue.',
    updated: '2026-10-10',
    software: true,
  },
  {
    path: '/kanban-and-sprint-boards',
    name: 'Kanban and sprint boards',
    title: 'Self-hosted Kanban and Scrum boards with sprints · Bemmoly',
    description:
      'Kanban or Scrum per project on your own server: columns mapped to statuses, WIP limits, swimlanes, a backlog with sprints, velocity, burndown and cycle time.',
    updated: '2026-10-10',
    software: true,
  },
  {
    path: '/on-premise',
    name: 'On-premise',
    title: 'On-premise project management: your data, your server',
    description:
      'Run Bemmoly on your own hardware or cloud: your data in your Postgres, verified and encrypted backups, signed updates, and nothing calls home by default.',
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
    path: '/docs/install',
    name: 'Install guide',
    title: 'Install guide: Bemmoly on a Linux server in one command',
    description:
      'Step by step: pick a VM, point a domain at it, run one command and open the address it prints. What the installer checks, what it writes and what to do next.',
    updated: '2026-10-10',
    software: true,
  },
  {
    path: '/docs/compose',
    name: 'Docker Compose',
    title: 'Run Bemmoly with Docker Compose: a self-hosted setup guide',
    description:
      'Run Bemmoly from the Compose file the installer writes: four services, three of them optional, and one .env file. Every setting explained, then one command.',
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

/**
 * The live demo's landing route: not an Astro page but apps/web's demo build, which
 * scripts/bundle-demo.ts copies into dist/demo with this title, description and share card.
 * It is the demo's one indexable address (the Caddyfile marks the routes under it noindex),
 * so it is in the sitemap and llms.txt beside the pages.
 */
export const DEMO_PAGE = {
  path: '/demo',
  name: 'Live demo',
  title: 'Live demo: Bemmoly issues, boards and sprints',
  description:
    'Click through Bemmoly in your browser: a sprint board, the backlog, issues and the workflow editor, on sample data that resets when you reload.',
  updated: '2026-10-10',
} as const satisfies SitePage;

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

/** The guides and topic pages linked from every page's footer and from each other. */
export const TOPICS: readonly PagePath[] = [
  '/self-hosted-project-management',
  '/open-source-issue-tracker',
  '/kanban-and-sprint-boards',
  '/on-premise',
  '/docs/install',
  '/docs/compose',
];
