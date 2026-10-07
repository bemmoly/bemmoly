/**
 * Release steps run by .github/workflows/release.yml, from the repository root:
 *
 *   node tools/release/src/cli.ts plan [--tag vX.Y.Z]          key=value lines for GITHUB_OUTPUT
 *   node tools/release/src/cli.ts tag                           changesets publish step (tags locally)
 *   node tools/release/src/cli.ts notes --version X --image I --repository O/N --out notes.md
 *   node tools/release/src/cli.ts manifest --version X --notes-url U --app-image I
 *        --updater-image I [--app-digest D] [--updater-digest D] --out manifest.json
 */
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { collectChanges } from './changes.ts';
import { diffConfig, ENV_EXAMPLE_PATH } from './config-changes.ts';
import { addedFiles, createTag, fileAt, releaseTags, tagExists } from './git.ts';
import { buildManifest } from './manifest.ts';
import { renderNotes } from './notes.ts';
import { describeChangeset, isChangesetFile } from './schema-changes.ts';
import { parseRelease, previousRelease, type Release } from './version.ts';

/** The fixed changesets group moves every package together; the server's version is the product's. */
const VERSION_SOURCE = 'apps/server/package.json';
const VERSION_PACKAGE = '@bemmoly/server';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    tag: { type: 'string' },
    version: { type: 'string' },
    image: { type: 'string' },
    repository: { type: 'string' },
    out: { type: 'string' },
    'notes-url': { type: 'string' },
    'app-image': { type: 'string' },
    'updater-image': { type: 'string' },
    'app-digest': { type: 'string' },
    'updater-digest': { type: 'string' },
  },
});

function required(name: keyof typeof values): string {
  const value = values[name];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`--${name} is required`);
  return value;
}

function productRelease(): Release {
  const { version } = JSON.parse(readFileSync(VERSION_SOURCE, 'utf8')) as { version: string };
  return parseRelease(version);
}

function changelogFiles(): string[] {
  return ['apps', 'packages', 'modules']
    .filter((folder) => existsSync(folder))
    .flatMap((folder) => readdirSync(folder).map((name) => `${folder}/${name}/CHANGELOG.md`))
    .filter((path) => existsSync(path));
}

function releaseFacts(release: Release) {
  const previous = previousRelease(release, releaseTags())?.tag;
  const schema = addedFiles(previous)
    .filter(isChangesetFile)
    .sort()
    .map((path) => describeChangeset(path, readFileSync(path, 'utf8')));
  const config = diffConfig(
    fileAt(previous, ENV_EXAMPLE_PATH),
    readFileSync(ENV_EXAMPLE_PATH, 'utf8'),
  );
  return { schema, config, firstRelease: previous === undefined };
}

function write(text: string): void {
  if (values.out) writeFileSync(values.out, text.endsWith('\n') ? text : `${text}\n`);
  else process.stdout.write(`${text}\n`);
}

const commands: Record<string, () => void> = {
  plan() {
    const release = values.tag ? parseRelease(values.tag) : productRelease();
    write(
      Object.entries(release)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join('\n'),
    );
  },
  tag() {
    const release = productRelease();
    if (release.version === '0.0.0') {
      process.stdout.write('No version has been released yet; nothing to tag\n');
      return;
    }
    if (tagExists(release.tag)) {
      process.stdout.write(`${release.tag} already exists; nothing to release\n`);
      return;
    }
    createTag(release.tag, `Bemmoly ${release.version}`);
    process.stdout.write(`Tagged ${release.tag}\n`);
    // The changesets action pushes the tags listed in this file and reports them as published.
    const output = process.env['CHANGESETS_OUTPUT'];
    if (output) {
      const event = { type: 'git-tag', tag: release.tag, packageName: VERSION_PACKAGE };
      appendFileSync(output, `${JSON.stringify(event)}\n`);
    }
  },
  notes() {
    const release = parseRelease(required('version'));
    const changes = collectChanges(
      changelogFiles().map((path) => readFileSync(path, 'utf8')),
      release.version,
    );
    write(
      renderNotes({
        release,
        changes,
        ...releaseFacts(release),
        image: required('image'),
        repository: required('repository'),
      }),
    );
  },
  manifest() {
    const release = parseRelease(required('version'));
    const manifest = buildManifest({
      release,
      publishedAt: new Date(),
      notesUrl: required('notes-url'),
      appImage: required('app-image'),
      updaterImage: required('updater-image'),
      appDigest: values['app-digest'],
      updaterDigest: values['updater-digest'],
      ...releaseFacts(release),
    });
    write(JSON.stringify(manifest, null, 2));
  },
};

const command = commands[positionals[0] ?? ''];
if (!command) {
  process.stderr.write(`Usage: cli.ts <${Object.keys(commands).join('|')}> [options]\n`);
  process.exit(2);
}
command();
