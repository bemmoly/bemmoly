import type { DiscoverySignal } from '../../../../shared/catalog-writes.ts';
import type { Runtime } from '../../../../shared/common.ts';
import type { RepositoryTree } from '../code/repository-reader.ts';
import { applicationPathOf, isApplicationFile } from '../catalog-writes/file.ts';
import { dirOf, ownersOf, parseCodeowners } from './globs.ts';
import { recordOf, stringOf, yamlDocumentsOf, yamlOf } from './manifests.ts';
import { detectWorkspaceMembers } from './workspaces.ts';

/*
 * What in a repository is deployable (architecture §9): Dockerfiles, Helm charts, serverless
 * manifests and workspace members that run, named from their own manifests, owned per
 * CODEOWNERS or Backstage's catalog-info.yaml. Pure over a tree, so fixture repositories test
 * it without a network. Folders that already hold an application.yaml are in the catalog
 * and are never proposed again.
 */

export interface DetectedApplication {
  path: string;
  key: string;
  name: string;
  description: string | null;
  signals: DiscoverySignal[];
  runtime: Runtime;
  owner: { raw: string; source: 'codeowners' | 'backstage' } | null;
  /** A Backstage system, which usually names a group. */
  system: string | null;
}

export interface Candidate {
  signals: Set<DiscoverySignal>;
  name: string | null;
  description: string | null;
  runtime: Runtime | null;
  owner: DetectedApplication['owner'];
  system: string | null;
}

const IGNORED = /(^|\/)(node_modules|vendor|\.git|testdata|fixtures|examples?)(\/|$)/;
const CODEOWNERS = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'];

const baseOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export function slugOf(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/^@[^/]+\//, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 63) || 'app'
  );
}

export class Candidates {
  readonly byPath = new Map<string, Candidate>();
  private readonly skip: ReadonlySet<string>;

  constructor(skip: ReadonlySet<string>) {
    this.skip = skip;
  }

  add(path: string, signal: DiscoverySignal, details: Partial<Omit<Candidate, 'signals'>> = {}) {
    if (this.skip.has(path) || IGNORED.test(path)) return;
    const candidate = this.byPath.get(path) ?? {
      signals: new Set<DiscoverySignal>(),
      name: null,
      description: null,
      runtime: null,
      owner: null,
      system: null,
    };
    candidate.signals.add(signal);
    candidate.name ??= details.name ?? null;
    candidate.description ??= details.description ?? null;
    candidate.runtime ??= details.runtime ?? null;
    candidate.owner ??= details.owner ?? null;
    candidate.system ??= details.system ?? null;
    this.byPath.set(path, candidate);
  }
}

async function detectManifests(tree: RepositoryTree, found: Candidates) {
  for (const path of tree.paths) {
    if (IGNORED.test(path)) continue;
    const base = baseOf(path);
    const dir = dirOf(path);
    if (base === 'Dockerfile') found.add(dir, 'dockerfile');
    else if (base === 'Chart.yaml') {
      const chart = yamlOf(await tree.read(path));
      found.add(dir, 'helm', {
        name: stringOf(chart?.name),
        runtime: 'kubernetes',
        description: stringOf(chart?.description),
      });
    } else if (base === 'serverless.yml' || base === 'serverless.yaml') {
      const manifest = yamlOf(await tree.read(path));
      const service = manifest?.service;
      found.add(dir, 'serverless', {
        name: stringOf(typeof service === 'object' ? recordOf(service).name : service),
        runtime: 'function',
      });
    } else if (base === 'template.yaml' || base === 'template.yml') {
      const text = await tree.read(path);
      if (text?.includes('AWS::Serverless')) found.add(dir, 'sam', { runtime: 'function' });
    } else if (base === 'catalog-info.yaml' || base === 'catalog-info.yml') {
      for (const doc of yamlDocumentsOf(await tree.read(path))) {
        if (doc.kind !== 'Component') continue;
        const metadata = recordOf(doc.metadata);
        const spec = recordOf(doc.spec);
        const owner = stringOf(spec.owner);
        found.add(dir, 'backstage', {
          name: stringOf(metadata.name),
          description: stringOf(metadata.description),
          owner: owner ? { raw: owner, source: 'backstage' } : null,
          system: stringOf(spec.system),
          ...(spec.type === 'website' ? { runtime: 'static-site' as const } : {}),
        });
      }
    } else if (base === 'BUILD' || base === 'BUILD.bazel') {
      const text = await tree.read(path);
      if (text && /\b(oci_image|container_image|docker_image)\s*\(/.test(text))
        found.add(dir, 'bazel');
    }
  }
}

/** Charts usually sit apart from their code (charts/checkout-api); fold them into it by name. */
function foldCharts(found: Candidates) {
  for (const [path, candidate] of found.byPath) {
    if (!candidate.signals.has('helm') || candidate.signals.size > 1 || !candidate.name) continue;
    const name = slugOf(candidate.name);
    const code = [...found.byPath].find(
      ([other, c]) =>
        other !== path && !c.signals.has('helm') && slugOf(c.name ?? baseOf(other)) === name,
    );
    if (!code) continue;
    code[1].signals.add('helm');
    code[1].runtime = 'kubernetes';
    found.byPath.delete(path);
  }
}

export async function detectApplications(
  tree: RepositoryTree,
  repositoryName: string,
): Promise<DetectedApplication[]> {
  const cataloged = new Set(tree.paths.filter(isApplicationFile).map(applicationPathOf));
  const found = new Candidates(cataloged);
  await detectManifests(tree, found);
  await detectWorkspaceMembers(tree, found);
  foldCharts(found);

  let rules: ReturnType<typeof parseCodeowners> = [];
  for (const path of CODEOWNERS) {
    if (!tree.paths.includes(path)) continue;
    rules = parseCodeowners((await tree.read(path)) ?? '');
    break;
  }
  const repoName = baseOf(repositoryName);
  const used = new Set<string>();
  const apps: DetectedApplication[] = [];
  for (const [path, candidate] of [...found.byPath].sort(([a], [b]) => a.localeCompare(b))) {
    const name = candidate.name ?? (path ? baseOf(path) : repoName);
    let key = slugOf(name);
    for (let n = 2; used.has(key); n += 1) key = `${slugOf(name).slice(0, 60)}-${n}`;
    used.add(key);
    const codeowner = ownersOf(rules, path)[0];
    apps.push({
      path,
      key,
      name: name.replace(/^@[^/]+\//, ''),
      description: candidate.description,
      signals: [...candidate.signals].sort(),
      runtime: candidate.runtime ?? 'container-service',
      owner: candidate.owner ?? (codeowner ? { raw: codeowner, source: 'codeowners' } : null),
      system: candidate.system,
    });
  }
  return apps;
}
