import type { BackupLocation } from '@bemmoly/shared';
import { text } from 'node:stream/consumers';
import type { SystemDependencies } from '../deps.ts';
import { resolveDestinations } from './destinations/index.ts';
import { MANIFEST_FILE, manifestSize, parseManifest, type BackupManifest } from './manifest.ts';

/**
 * Adds rows for complete sets found in the destinations that the database does not
 * know: after a restore (the restored table predates later backups) and on a new
 * machine whose backups folder was copied over. Returns the set names added.
 */
export async function syncBackupIndex(
  deps: SystemDependencies,
  options: { interruptedBefore?: Date } = {},
): Promise<string[]> {
  const found = new Map<string, { manifest: BackupManifest; locations: BackupLocation[] }>();
  for (const destination of await resolveDestinations(deps)) {
    for (const setName of await destination.listSets()) {
      if (!(await destination.exists(setName, MANIFEST_FILE))) continue;
      const entry = found.get(setName);
      const location = { destination: destination.kind, location: destination.describe(setName) };
      if (entry) {
        entry.locations.push(location);
        continue;
      }
      try {
        const manifest = parseManifest(await text(await destination.read(setName, MANIFEST_FILE)));
        found.set(setName, { manifest, locations: [location] });
      } catch (error) {
        deps.logger.warn(
          { err: error, set: setName },
          'skipped a backup set with an unreadable manifest',
        );
      }
    }
  }
  const known = new Map(
    (
      await deps.sql<{ set_name: string; status: string }[]>`select set_name, status from backups`
    ).map((row) => [row.set_name, row.status]),
  );
  const added: string[] = [];
  for (const [setName, { manifest, locations }] of found) {
    if (known.get(setName) === 'running') {
      // A restored database is a snapshot taken while this backup was still writing.
      await deps.sql`
        update backups set status = 'succeeded', locations = ${deps.sql.json(locations as never)},
          manifest = ${deps.sql.json(manifest as never)}, attachment_mode = ${manifest.attachments.mode},
          encrypted = ${manifest.encryption !== null}, size_bytes = ${manifestSize(manifest)},
          database_bytes = ${manifest.database.sizeBytes},
          attachments_bytes = ${manifest.attachments.archive?.sizeBytes ?? 0},
          verification_state = 'listed', completed_at = ${new Date(manifest.createdAt)}, updated_at = now()
        where set_name = ${setName} and status = 'running'`;
      added.push(setName);
      continue;
    }
    if (known.has(setName)) continue;
    const created = new Date(manifest.createdAt);
    const result = await deps.sql`
      insert into backups (id, kind, status, set_name, app_version, changelog_tag, attachment_mode,
        encrypted, size_bytes, database_bytes, attachments_bytes, locations, manifest,
        verification_state, created_at, completed_at)
      values (${manifest.id}, ${manifest.kind}, 'succeeded', ${setName}, ${manifest.appVersion},
        ${manifest.changelogTag}, ${manifest.attachments.mode}, ${manifest.encryption !== null},
        ${manifestSize(manifest)}, ${manifest.database.sizeBytes},
        ${manifest.attachments.archive?.sizeBytes ?? 0}, ${deps.sql.json(locations as never)},
        ${deps.sql.json(manifest as never)}, 'pending', ${created}, ${created})
      on conflict do nothing`;
    if (result.count > 0) added.push(setName);
  }
  if (options.interruptedBefore) {
    // Runs the snapshot caught half-way whose set never got a manifest did not finish.
    await deps.sql`
      update backups set status = 'failed', error = 'Interrupted: the database was restored while it ran',
        completed_at = now(), updated_at = now()
      where status = 'running' and created_at < ${options.interruptedBefore}`;
  }
  return added;
}
