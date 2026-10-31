import path from 'node:path';
import { REPOSITORY_FILE_PATH } from '../../../../shared/repository-yaml.ts';
import type { RepositoryTree } from '../code/repository-reader.ts';
import type { Candidates } from './detect.ts';
import { dirOf } from './globs.ts';
import { jsonOf, recordOf, stringOf, yamlOf } from './manifests.ts';

/*
 * One Dockerfile for many deployables, the usual monorepo shape: a shared Dockerfile with an
 * ARG that picks the folder (`COPY services/${SERVICE} …`), or a compose file whose services
 * build one Dockerfile with different args. Each folder found this way is proposed, and the
 * build it shares goes into the repository file discovery proposes, so the pull request holds
 * one file with the Dockerfile and args in `defaults` and a short entry per application.
 */

/** A shared build as found: arg values are literal until the application's key is known. */
export interface FoundBuild {
  dockerfile: string;
  context: string;
  args: Record<string, string>;
}

const IGNORED = /(^|\/)(node_modules|vendor|\.git|testdata|fixtures|examples?)(\/|$)/;
const SHARED_DOCKERFILE = /(^|\/)(Dockerfile\.[^/]+|[^/]+\.Dockerfile)$/;
const COMPOSE = /(^|\/)(docker-)?compose\.ya?ml$/;
const PATH_LIKE = /(PATH|DIR|FOLDER)$/i;

const baseOf = (file: string) => file.slice(file.lastIndexOf('/') + 1);
const inside = (dir: string, file: string) => (dir ? file.startsWith(`${dir}/`) : true);
const ownDockerfile = (tree: RepositoryTree, folder: string) =>
  tree.paths.includes(`${folder}/Dockerfile`);

/** "services/${SERVICE}" in a Dockerfile: the ARG that picks a folder, and the folder above. */
function selectorOf(text: string): { arg: string; parent: string } | null {
  const declared = [...text.matchAll(/^\s*ARG\s+([A-Za-z_][A-Za-z0-9_]*)/gm)].map((m) => m[1]);
  for (const arg of declared) {
    if (!arg) continue;
    const used = new RegExp(`([A-Za-z0-9_./-]+)/\\$\\{?${arg}\\}?(?![A-Za-z0-9_])`).exec(text);
    if (used?.[1]) return { arg, parent: used[1].replace(/^\.\//, '').replace(/\/+$/, '') };
  }
  return null;
}

/** Folders right under `parent` that hold files: the deployables a shared Dockerfile builds. */
function childFolders(tree: RepositoryTree, parent: string): string[] {
  const folders = new Set<string>();
  for (const file of tree.paths) {
    if (!inside(parent, file) || IGNORED.test(file)) continue;
    const rest = parent ? file.slice(parent.length + 1) : file;
    const [first, ...more] = rest.split('/');
    if (first && more.length > 0) folders.add(parent ? `${parent}/${first}` : first);
  }
  return [...folders].sort();
}

async function packageName(tree: RepositoryTree, folder: string): Promise<string | null> {
  const manifest = `${folder}/package.json`;
  return tree.paths.includes(manifest) ? stringOf(jsonOf(await tree.read(manifest))?.name) : null;
}

async function fromDockerfiles(tree: RepositoryTree, found: Candidates) {
  const builds = new Map<string, FoundBuild>();
  for (const dockerfile of tree.paths.filter((file) => SHARED_DOCKERFILE.test(file)).sort()) {
    if (IGNORED.test(dockerfile)) continue;
    const selector = selectorOf((await tree.read(dockerfile)) ?? '');
    if (!selector) continue;
    const folders = childFolders(tree, selector.parent);
    if (folders.length < 2) continue;
    for (const folder of folders) {
      if (builds.has(folder) || ownDockerfile(tree, folder)) continue;
      found.add(folder, 'shared-dockerfile', { name: await packageName(tree, folder) });
      builds.set(folder, { dockerfile, context: '.', args: { [selector.arg]: baseOf(folder) } });
    }
  }
  return builds;
}

interface ComposeService {
  name: string;
  dockerfile: string;
  context: string;
  args: Record<string, string>;
}

function composeServices(file: string, text: string | null): ComposeService[] {
  const dir = dirOf(file);
  const services = recordOf(yamlOf(text)?.services);
  return Object.entries(services).flatMap(([name, value]) => {
    const build = recordOf(recordOf(value).build);
    const context = path.posix.normalize(
      path.posix.join(dir || '.', stringOf(build.context) ?? '.'),
    );
    const dockerfile = stringOf(build.dockerfile);
    if (!dockerfile || context.startsWith('..')) return [];
    const args = Object.fromEntries(
      Object.entries(recordOf(build.args)).flatMap(([arg, raw]) =>
        typeof raw === 'string' || typeof raw === 'number' ? [[arg, String(raw)]] : [],
      ),
    );
    const full = path.posix.normalize(path.posix.join(context, dockerfile));
    return [{ name, dockerfile: full, context, args }];
  });
}

/** Compose services that build one Dockerfile; each lands on a folder named by an arg. */
async function fromCompose(tree: RepositoryTree, found: Candidates) {
  const builds = new Map<string, FoundBuild>();
  for (const file of tree.paths.filter((item) => COMPOSE.test(item) && !IGNORED.test(item))) {
    const services = composeServices(file, await tree.read(file));
    const byDockerfile = new Map<string, ComposeService[]>();
    for (const service of services) {
      byDockerfile.set(service.dockerfile, [
        ...(byDockerfile.get(service.dockerfile) ?? []),
        service,
      ]);
    }
    for (const [dockerfile, sharing] of byDockerfile) {
      if (sharing.length < 2) continue;
      for (const service of sharing) {
        const folder = Object.values(service.args)
          .flatMap((value) => [
            value,
            ...tree.paths.map(dirOf).filter((dir) => baseOf(dir) === value),
          ])
          .find((dir) => dir.length > 0 && tree.paths.some((item) => inside(dir, item)));
        if (!folder || builds.has(folder) || ownDockerfile(tree, folder)) continue;
        found.add(folder, 'shared-dockerfile', {
          name: (await packageName(tree, folder)) ?? service.name,
        });
        const context = service.context === '.' ? '.' : service.context;
        builds.set(folder, { dockerfile, context, args: service.args });
      }
    }
  }
  return builds;
}

/** Shared builds by folder; none when the repository already has a repository file. */
export async function detectSharedBuilds(
  tree: RepositoryTree,
  found: Candidates,
): Promise<Map<string, FoundBuild>> {
  if (tree.paths.includes(REPOSITORY_FILE_PATH)) return new Map();
  const builds = await fromDockerfiles(tree, found);
  for (const [folder, build] of await fromCompose(tree, found)) {
    if (!builds.has(folder)) builds.set(folder, build);
  }
  return builds;
}

/** An arg holding the application's key or folder becomes `${{ app.name }}` or `${{ app.path }}`. */
export function templated(build: FoundBuild, app: { key: string; path: string }): FoundBuild {
  const args = Object.fromEntries(
    Object.entries(build.args).map(([arg, value]) => {
      if (value === app.path) return [arg, '${{ app.path }}'];
      if (value === app.key && !PATH_LIKE.test(arg)) return [arg, '${{ app.name }}'];
      return [arg, value];
    }),
  );
  return { ...build, args };
}
