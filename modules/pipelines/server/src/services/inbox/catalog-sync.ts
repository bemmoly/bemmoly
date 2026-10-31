import { APPLICATION_FILE_PATH } from '../../../../shared/application-yaml.ts';
import { REPOSITORY_FILE_PATH } from '../../../../shared/repository-yaml.ts';
import type { CatalogWritesService } from '../catalog-writes/index.ts';
import type { PipelinesCodeHosts } from '../code/hosts.ts';
import type { InboxHandlers } from './handlers.ts';

/*
 * The catalog lives with the code (architecture §9): a push to the default branch that
 * touches an application.yaml or the repository file is read at the pushed commit and
 * applied. The repository file is read with every such push, since each application merges
 * its defaults. When the push changed the repository file, or the host cut the push's file
 * list short, every catalog file in the tree is read instead, so no application is left
 * behind and one dropped from the central list is archived.
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
    const repositoryFileTouched = push.changedFiles.includes(REPOSITORY_FILE_PATH);
    if (touched.length === 0 && !repositoryFileTouched && !push.truncated) return;
    const client = await hosts.client(event.repository, 'live');
    if (!client) return;
    const complete = push.truncated || repositoryFileTouched;
    const paths = complete
      ? (await client.listFiles(event.repository, push.after)).paths.filter(isApplicationFile)
      : touched;
    const files = await Promise.all(
      [REPOSITORY_FILE_PATH, ...paths].map(async (path) => ({
        path,
        content: await client.readFile(event.repository, path, push.after),
      })),
    );
    // A repository with no repository file and no application.yaml has nothing to sync.
    if (paths.length === 0 && files[0]?.content === null && !repositoryFileTouched) return;
    await catalog.applyApplicationFiles(ctx, {
      repository: {
        fullName: event.repository,
        provider: event.hostKind,
        ...(push.defaultBranch ? { defaultBranch: push.defaultBranch } : {}),
      },
      commitSha: push.after,
      files,
      complete,
    });
  });
}
