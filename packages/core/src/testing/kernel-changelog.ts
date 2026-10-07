import type { SqlClient } from '../clients/postgres.ts';
import {
  createChangelogRunner,
  loadKernelChangelog,
  type KernelChangelogRunner,
} from '../services/changelog/index.ts';

/** The real runner over packages/core/changelog, as integration tests use it. */
export async function kernelChangelogRunner(sql: SqlClient): Promise<KernelChangelogRunner> {
  return createChangelogRunner({ sql, kernel: await loadKernelChangelog(), appVersion: '0.0.0' });
}

/** Applies every kernel changeset (00xx, 01xx, 02xx) from empty, with the test context. */
export async function applyKernelChangelog(sql: SqlClient): Promise<void> {
  const runner = await kernelChangelogRunner(sql);
  await runner.update({ contexts: ['test'] });
}
