/**
 * Release notes shown on /changelog. Releases are assembled from .changeset entries (see
 * AGENTS.md, Versioning and releases); once the first release is cut, this list is replaced
 * by the notes the changesets tool generates.
 */
export interface Release {
  version: string;
  /** ISO date of the release, or null while it is in progress. */
  date: string | null;
  summary: string;
  notes: readonly string[];
}

export const RELEASES: readonly Release[] = [
  {
    version: '0.1.0',
    date: null,
    summary: 'In progress. The foundation every later release is built on.',
    notes: [
      'One-command install on a VM with Postgres 18, HTTPS, nightly backups and the updater.',
      'The six-step setup wizard, eight theme presets and a custom brand colour, light and dark.',
      'People, invitations, teams, roles with org locks, modules, email and an audit log.',
      'Upgrades and rollback from the app or the bemmoly command, with a backup first.',
    ],
  },
];
