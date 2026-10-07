/** The site's pages, for llms.txt and the structured data; the same titles the pages carry. */
export interface SitePage {
  path: string;
  title: string;
  description: string;
}

export const PAGES: readonly SitePage[] = [
  {
    path: '/',
    title: 'Bemmoly',
    description:
      'Open source, self-hosted, AI-first issues and docs for your whole company. One container, one Postgres, no per-seat pricing.',
  },
  {
    path: '/self-hosting',
    title: 'Self-hosting',
    description:
      'Run Bemmoly on a fresh Linux VM with one command, or start from the Docker Compose, Kubernetes, Postgres or offline setup you already have. HTTPS, backups and upgrades are built in.',
  },
  {
    path: '/docs',
    title: 'Docs',
    description:
      'Where the documentation lives while it is written: self-hosting, the README and the technical design.',
  },
  {
    path: '/changelog',
    title: 'Changelog',
    description: 'What changed in each Bemmoly release.',
  },
  {
    path: '/security',
    title: 'Security',
    description:
      'How to report a vulnerability in Bemmoly privately, what happens next, and which versions receive security fixes.',
  },
  {
    path: '/community',
    title: 'Community',
    description: 'Where to ask questions, report bugs and help build Bemmoly.',
  },
];
