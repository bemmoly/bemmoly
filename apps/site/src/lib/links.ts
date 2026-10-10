/** Every URL the site points at, in one place. */

export const SITE_URL = 'https://bemmoly.com';
export const INSTALL_HOST = 'get.bemmoly.com';
export const INSTALL_COMMAND = `curl -fsSL https://${INSTALL_HOST} | sh`;
/** Download, then read, then run: for everyone who will not pipe a script to sh unseen. */
export const INSTALL_READ_FIRST = `curl -fsSL https://${INSTALL_HOST} -o install.sh && less install.sh`;

export const REPO_URL = 'https://github.com/bemmoly/bemmoly';
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md`;
export const CODE_OF_CONDUCT_URL = `${REPO_URL}/blob/main/CODE_OF_CONDUCT.md`;
export const ISSUES_URL = `${REPO_URL}/issues`;
export const TECH_DESIGN_URL = `${REPO_URL}/blob/main/docs/tech-design.html`;
export const RELEASES_URL = `${REPO_URL}/releases/latest`;
export const COMPOSE_URL = `${REPO_URL}/tree/main/deploy/compose`;
/** A file in the repository, as a proof link: the line a claim rests on lives there. */
export const sourceUrl = (path: string) => `${REPO_URL}/blob/main/${path}`;
/** The live demo: apps/web's demo build, served by this site (scripts/bundle-demo.ts). */
export const DEMO_URL = '/demo';

export interface NavLink {
  label: string;
  href: string;
}

/**
 * Top navigation, from the site review. The site's own documentation is "Guides", so "Docs"
 * only ever means the product module; the addresses stay (/docs/install is in the installer's
 * messages).
 */
export const NAV: readonly NavLink[] = [
  { label: 'Product', href: '/#product' },
  { label: 'Self-hosting', href: '/self-hosting' },
  { label: 'Guides', href: '/docs' },
  { label: 'Changelog', href: '/changelog' },
];

/** Where "Install" goes from every page: the homepage's install section. */
export const INSTALL_HREF = '/#install';

export interface FooterColumn {
  title: string;
  links: readonly NavLink[];
}

/** The footer's columns. Discord joins Open source once its invite exists. */
export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Work', href: '/#work' },
      { label: 'Docs', href: '/#docs' },
      { label: 'AI (coming)', href: '/#ai' },
      { label: 'Live demo', href: DEMO_URL },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    title: 'Self-host',
    links: [
      { label: 'Install guide', href: '/docs/install' },
      { label: 'Docker Compose', href: '/docs/compose' },
      { label: 'All the ways to run it', href: '/self-hosting' },
      { label: 'Sizing', href: '/self-hosting#sizing' },
      { label: 'Security', href: '/security' },
    ],
  },
  {
    title: 'Open source',
    links: [
      { label: 'GitHub', href: REPO_URL },
      { label: 'MIT licence', href: LICENSE_URL },
      { label: 'Contributing', href: CONTRIBUTING_URL },
      { label: 'Code of conduct', href: CODE_OF_CONDUCT_URL },
      { label: 'Community', href: '/community' },
    ],
  },
];
