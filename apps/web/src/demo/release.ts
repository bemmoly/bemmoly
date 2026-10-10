import type { MockDb } from '../mocks/db.ts';

/**
 * Makes the demo report one version everywhere: the release it was built from. The mocks tell
 * an update story (0.1.1 installed, 0.1.2 waiting, a rollback to 0.1.0) for the updater's
 * screens; the public demo is the newest release, up to date, so it names no other version
 * than the one the rest of bemmoly.com shows.
 */
export function atRelease(db: MockDb, version: string): void {
  db.system = { ...db.system, version };
  db.updates = {
    ...db.updates,
    current: { ...db.updates.current, version, previousVersion: null },
    available: null,
    rollback: null,
    updater: { ...db.updates.updater, command: 'sudo bemmoly upgrade' },
  };
  db.backups = db.backups.map((backup) => ({
    ...backup,
    appVersion: version,
    changelogTag: version,
  }));
  db.adminModules = db.adminModules.map((module) => ({
    ...module,
    version,
    versionInstalled: module.versionInstalled === null ? null : version,
  }));
  db.manifests = db.manifests.map((manifest) => ({ ...manifest, version }));
  db.audit = db.audit.map((entry) =>
    entry.action === 'update.applied' ? { ...entry, targetId: version } : entry,
  );
}
