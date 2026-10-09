/** Every URL the site points at, in one place. */

export const SITE_URL = 'https://bemmoly.com';
export const INSTALL_HOST = 'get.bemmoly.com';
export const INSTALL_COMMAND = `curl -fsSL https://${INSTALL_HOST} | sh`;

export const REPO_URL = 'https://github.com/bemmoly/bemmoly';
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md`;
export const CODE_OF_CONDUCT_URL = `${REPO_URL}/blob/main/CODE_OF_CONDUCT.md`;
export const ISSUES_URL = `${REPO_URL}/issues`;
export const TECH_DESIGN_URL = `${REPO_URL}/blob/main/docs/tech-design.html`;
export const RELEASES_URL = `${REPO_URL}/releases/latest`;
export const COMPOSE_URL = `${REPO_URL}/tree/main/deploy/compose`;

export interface NavLink {
  label: string;
  href: string;
}

/** Top navigation, in the mock's order. */
export const NAV: readonly NavLink[] = [
  { label: 'Product', href: '/#product' },
  { label: 'Self-hosting', href: '/self-hosting' },
  { label: 'Docs', href: '/docs' },
  { label: 'Community', href: '/community' },
  { label: 'GitHub', href: REPO_URL },
];

/** Footer links after "Bemmoly", in the mock's order. Discord has no invite yet. */
export const FOOTER: readonly NavLink[] = [
  { label: 'MIT license', href: LICENSE_URL },
  { label: 'Docs', href: '/docs' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Security', href: '/security' },
  { label: 'Discord', href: '/community#discord' },
];
