import { APPLICATION_FILE_PATH } from '../../../../shared/application-yaml.ts';
import type { CatalogWritesService } from '../catalog-writes/index.ts';
import type { PipelinesCodeHosts } from '../code/hosts.ts';
import type { InboxHandlers } from './handlers.ts';

/*
 * The catalog lives with the code (architecture §9): a push to the default branch that
 * touches an application.yaml is read at the pushed commit and applied. When the host cut
 * the push's file list short, every application.yaml in the tree is read instead, so a
 * large merge never leaves the catalog behind.
 */

const isApplicationFile = (path: string) =>
  path === APPLICATION_FILE_PATH || path.endsWith(`/${APPLICATION_FILE_PATH}`);

export function registerCatalogSync(
  handlers: InboxHandlers,
  hosts: PipelinesCodeHosts,
  catalog: Pick<CatalogWritesService, 'applyApplicationFiles'>,
): void {
  handlers.on('push', async (event, ctx) => {
    const { push } = event;
    if (!push.isDefaultBranch || push.deleted) return;
    const touched = push.changedFiles.filter(isApplicationFile);
    if (touched.length === 0 && !push.truncated) return;
    const client = await hosts.client(event.repository, 'live');
    if (!client) return;
    const paths = push.truncated
      ? (await client.listFiles(event.repository, push.after)).paths.filter(isApplicationFile)
      : touched;
    if (paths.length === 0) return;
    const files = await Promise.all(
      paths.map(async (path) => ({
        path,
        content: await client.readFile(event.repository, path, push.after),
      })),
    );
    await catalog.applyApplicationFiles(ctx, {
      repository: {
        fullName: event.repository,
        provider: event.hostKind,
        ...(push.defaultBranch ? { defaultBranch: push.defaultBranch } : {}),
      },
      commitSha: push.after,
      files,
    });
  });
}
