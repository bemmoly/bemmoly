import type { RepositoryTree } from '../code/repository-reader.ts';
import type { Candidates } from './detect.ts';
import { dirOf, matchesAny } from './globs.ts';
import {
  cargoMembers,
  goWorkUses,
  gradleIncludes,
  jsonOf,
  recordOf,
  stringOf,
  stringsOf,
  yamlOf,
} from './manifests.ts';

/*
 * Monorepo members that run (architecture §9): a library in a workspace is not an
 * application, so a member is proposed only when it shows it starts something: a start
 * script, a Nx application, a Go main package, a Rust binary, a Gradle application or Boot
 * plugin, or a Dockerfile of its own.
 */

const has = (tree: RepositoryTree, path: string) => tree.paths.includes(path);
const join = (dir: string, file: string) => (dir ? `${dir}/${file}` : file);
const under = (tree: RepositoryTree, dir: string, test: (rest: string) => boolean) =>
  tree.paths.some((path) =>
    dir ? path.startsWith(`${dir}/`) && test(path.slice(dir.length + 1)) : test(path),
  );

async function nodeMembers(tree: RepositoryTree, found: Candidates) {
  const pnpm = yamlOf(
    has(tree, 'pnpm-workspace.yaml') ? await tree.read('pnpm-workspace.yaml') : null,
  );
  const root = jsonOf(has(tree, 'package.json') ? await tree.read('package.json') : null);
  const npmGlobs = Array.isArray(root?.workspaces)
    ? stringsOf(root.workspaces)
    : stringsOf(recordOf(root?.workspaces).packages);
  const globs = pnpm ? stringsOf(pnpm.packages) : npmGlobs;
  if (globs.length === 0) return;
  const signal = pnpm ? 'pnpm-workspace' : 'npm-workspace';
  const turbo = has(tree, 'turbo.json');
  for (const path of tree.paths) {
    if (!path.endsWith('/package.json')) continue;
    const dir = dirOf(path);
    if (!matchesAny(dir, globs)) continue;
    const manifest = jsonOf(await tree.read(path));
    const scripts = recordOf(manifest?.scripts);
    const runs = Boolean(scripts.start ?? scripts.serve) || has(tree, join(dir, 'Dockerfile'));
    if (!runs) continue;
    const details = {
      name: stringOf(manifest?.name),
      description: stringOf(manifest?.description),
    };
    found.add(dir, signal, details);
    if (turbo) found.add(dir, 'turborepo', details);
  }
}

async function nxProjects(tree: RepositoryTree, found: Candidates) {
  for (const path of tree.paths) {
    if (!path.endsWith('project.json')) continue;
    const project = jsonOf(await tree.read(path));
    if (project?.projectType !== 'application') continue;
    found.add(dirOf(path), 'nx', { name: stringOf(project.name) });
  }
}

async function goModules(tree: RepositoryTree, found: Candidates) {
  const work = has(tree, 'go.work') ? goWorkUses(await tree.read('go.work')) : null;
  const modules =
    work ?? tree.paths.filter((path) => path === 'go.mod' || path.endsWith('/go.mod')).map(dirOf);
  for (const dir of modules) {
    const runs =
      under(tree, dir, (rest) => rest === 'main.go' || rest.startsWith('cmd/')) ||
      has(tree, join(dir, 'Dockerfile'));
    if (!runs) continue;
    const mod = (await tree.read(join(dir, 'go.mod'))) ?? '';
    const name = /^module\s+(\S+)/m.exec(mod)?.[1]?.split('/').at(-1) ?? null;
    found.add(dir, 'go-module', { name });
  }
}

async function cargoCrates(tree: RepositoryTree, found: Candidates) {
  if (!has(tree, 'Cargo.toml')) return;
  const members = cargoMembers(await tree.read('Cargo.toml'));
  const dirs = members
    ? tree.paths
        .filter((path) => path.endsWith('/Cargo.toml'))
        .map(dirOf)
        .filter((dir) => matchesAny(dir, members))
    : [''];
  for (const dir of dirs) {
    if (
      !has(tree, join(dir, 'src/main.rs')) &&
      !under(tree, dir, (rest) => rest.startsWith('src/bin/'))
    )
      continue;
    const manifest = (await tree.read(join(dir, 'Cargo.toml'))) ?? '';
    const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(manifest)?.[1] ?? null;
    found.add(dir, 'cargo', { name });
  }
}

async function gradleProjects(tree: RepositoryTree, found: Candidates) {
  const settings = ['settings.gradle', 'settings.gradle.kts'].find((path) => has(tree, path));
  if (!settings) return;
  for (const dir of gradleIncludes(await tree.read(settings))) {
    const build = [join(dir, 'build.gradle'), join(dir, 'build.gradle.kts')].find((path) =>
      has(tree, path),
    );
    const text = build ? ((await tree.read(build)) ?? '') : '';
    const runs =
      /\b(application|org\.springframework\.boot|io\.ktor\.plugin)\b/.test(text) ||
      has(tree, join(dir, 'Dockerfile'));
    if (runs) found.add(dir, 'gradle', { name: dir.split('/').at(-1) ?? dir });
  }
}

export async function detectWorkspaceMembers(tree: RepositoryTree, found: Candidates) {
  await nodeMembers(tree, found);
  await nxProjects(tree, found);
  await goModules(tree, found);
  await cargoCrates(tree, found);
  await gradleProjects(tree, found);
}
