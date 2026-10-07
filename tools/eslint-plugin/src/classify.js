import path from 'node:path';

/** Workspace package names that map to a folder other than packages/<name>. */
const PACKAGE_FOLDERS = {
  server: 'apps/server',
  web: 'apps/web',
  site: 'apps/site',
  'eslint-plugin': 'tools/eslint-plugin',
};

const toPosix = (value) => value.split(path.sep).join('/');

/**
 * @param {string} root absolute repository root
 * @param {string} filename absolute path of the linted file
 */
export function classifyFile(root, filename) {
  const rel = toPosix(path.relative(root, filename));
  const segments = rel.split('/');
  const moduleMatch = /^modules\/([^/]+)\/(.*)$/.exec(rel);
  const serviceMatch = /^packages\/core\/src\/services\/([^/]+)\//.exec(rel);
  return {
    rel,
    moduleId: moduleMatch?.[1],
    moduleWeb: moduleMatch?.[2]?.startsWith('web/') ?? false,
    kernelService: serviceMatch?.[1],
    inApp: rel.startsWith('apps/'),
    inServices: segments.slice(0, -1).includes('services'),
  };
}

/**
 * @param {string} root
 * @param {string} filename
 * @param {string} specifier
 */
export function classifyImport(root, filename, specifier) {
  if (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier === '.' ||
    specifier === '..'
  ) {
    const resolved = path.resolve(path.dirname(filename), specifier);
    return { kind: 'path', rel: toPosix(path.relative(root, resolved)) };
  }
  const workspace = /^@bemmoly\/([^/]+)(\/.*)?$/.exec(specifier);
  if (!workspace) return { kind: 'external' };
  const name = workspace[1] ?? '';
  const subpath = workspace[2] ?? '';
  const moduleId = name.startsWith('module-') ? name.slice('module-'.length) : undefined;
  const folder = moduleId ? `modules/${moduleId}` : (PACKAGE_FOLDERS[name] ?? `packages/${name}`);
  return { kind: 'workspace', name, subpath, moduleId, folder };
}
