import { describe, expect, it } from 'vitest';
import { collectChanges } from './changes.ts';
import { diffConfig } from './config-changes.ts';
import { buildManifest } from './manifest.ts';
import { renderNotes } from './notes.ts';
import { describeChangeset, isChangesetFile, rollbackMode } from './schema-changes.ts';
import { parseRelease } from './version.ts';

const SERVER_CHANGELOG = `# @bemmoly/server

## 0.2.0

### Minor Changes

- 1a2b3c4: Prometheus metrics at /metrics, protected by a scrape token
  Set BEMMOLY_METRICS_TOKEN to enable them.
- 5d6e7f8: Request ids in every error toast

### Patch Changes

- 9a8b7c6: Fix the theme switcher losing the preset on reload
- Updated dependencies [1a2b3c4]

## 0.1.0

### Minor Changes

- 0f0f0f0: First release
`;

const CORE_CHANGELOG = `# @bemmoly/core

## 0.2.0

### Minor Changes

- 1a2b3c4: Prometheus metrics at /metrics, protected by a scrape token
  Set BEMMOLY_METRICS_TOKEN to enable them.
`;

const RANK_CHANGESET = `export default changeset({
  id: '0007-issue-rank',
  author: 'maintainer',
  description: 'Add a rank column to issues and backfill it',
  async up(ctx) {
    await ctx.backfill('issues', { batch: 1000 }, async () => undefined);
  },
  async down(ctx) {},
});`;

const DROP_CHANGESET = `export default changeset({
  id: '0002-drop-legacy-flag',
  author: 'maintainer',
  description: "Drop the legacy flag column",
  irreversible: true,
  async up(ctx) {},
});`;

const INDEX_CHANGESET = `export default changeset({
  id: '0003-search-index',
  author: 'maintainer',
  description: 'Index page titles',
  transactional: false,
  up: async (ctx) => {},
  down: async (ctx) => {},
});`;

describe('release notes', () => {
  it('collects each entry once across package changelogs, without dependency noise', () => {
    const changes = collectChanges([SERVER_CHANGELOG, CORE_CHANGELOG], '0.2.0');
    expect(changes.minor).toEqual([
      'Prometheus metrics at /metrics, protected by a scrape token\nSet BEMMOLY_METRICS_TOKEN to enable them.',
      'Request ids in every error toast',
    ]);
    expect(changes.patch).toEqual(['Fix the theme switcher losing the preset on reload']);
    expect(collectChanges([SERVER_CHANGELOG], '0.3.0').minor).toEqual([]);
  });

  it('flags schema changesets that are slow or irreversible', () => {
    expect(isChangesetFile('modules/work/changelog/0007-issue-rank.ts')).toBe(true);
    expect(isChangesetFile('packages/core/changelog/0002-drop-legacy-flag.ts')).toBe(true);
    expect(isChangesetFile('packages/core/src/changelog.ts')).toBe(false);
    expect(isChangesetFile('modules/work/changelog/0007-issue-rank.test.ts')).toBe(false);
    const rank = describeChangeset('modules/work/changelog/0007-issue-rank.ts', RANK_CHANGESET);
    expect(rank).toEqual({
      module: 'work',
      id: '0007-issue-rank',
      description: 'Add a rank column to issues and backfill it',
      slow: true,
      irreversible: false,
    });
    const drop = describeChangeset(
      'packages/core/changelog/0002-drop-legacy-flag.ts',
      DROP_CHANGESET,
    );
    expect(drop).toMatchObject({ module: 'core', slow: false, irreversible: true });
    const index = describeChangeset('modules/docs/changelog/0003-search-index.ts', INDEX_CHANGESET);
    expect(index).toMatchObject({ slow: true, irreversible: false });
    expect(rollbackMode([rank, index])).toBe('code');
    expect(rollbackMode([rank, drop])).toBe('restore');
  });

  it('lists configuration keys added and removed', () => {
    const before = 'PORT=8080\n# comment\nLOG_LEVEL=info\nOLD_KEY=\n';
    const after = 'PORT=8080\nLOG_LEVEL=info\nBEMMOLY_METRICS_TOKEN=\n';
    expect(diffConfig(before, after)).toEqual({
      added: ['BEMMOLY_METRICS_TOKEN'],
      removed: ['OLD_KEY'],
    });
  });

  it('renders notes with changes, schema, configuration and the rollback mode', () => {
    const release = parseRelease('0.2.0');
    const schema = [
      describeChangeset('modules/work/changelog/0007-issue-rank.ts', RANK_CHANGESET),
      describeChangeset('packages/core/changelog/0002-drop-legacy-flag.ts', DROP_CHANGESET),
    ];
    const notes = renderNotes({
      release,
      changes: collectChanges([SERVER_CHANGELOG], '0.2.0'),
      schema,
      config: { added: ['BEMMOLY_METRICS_TOKEN'], removed: [] },
      image: 'ghcr.io/bemmoly/bemmoly',
      repository: 'bemmoly/bemmoly',
      firstRelease: false,
    });
    expect(notes).toContain('## Bemmoly 0.2.0\n');
    expect(notes).toContain('### New\n\n- Prometheus metrics');
    expect(notes).toContain(
      '| work | `0007-issue-rank` | Add a rank column to issues and backfill it | **slow on large tables** |',
    );
    expect(notes).toContain(
      '| core | `0002-drop-legacy-flag` | Drop the legacy flag column | **irreversible** |',
    );
    expect(notes).toContain('- Added `BEMMOLY_METRICS_TOKEN`');
    expect(notes).toContain('rolling back needs a restore');
    expect(notes).toContain('cosign verify ghcr.io/bemmoly/bemmoly:0.2.0');
    const quiet = renderNotes({
      release: parseRelease('0.2.1-beta.0'),
      changes: { major: [], minor: [], patch: [] },
      schema: [],
      config: { added: [], removed: [] },
      image: 'ghcr.io/bemmoly/bemmoly',
      repository: 'bemmoly/bemmoly',
      firstRelease: true,
    });
    expect(quiet).toContain('(beta channel)');
    expect(quiet).toContain('### Schema changes\n\nNone.');
    expect(quiet).toContain('code rollback: no data is lost');
    expect(quiet).toContain('First release: every key is described');
    expect(notes).toContain("'^https://github.com/bemmoly/bemmoly/.github/workflows/release.yml@'");
  });

  it('builds the release manifest with digests and the rollback mode', () => {
    const digest = `sha256:${'a'.repeat(64)}`;
    const manifest = buildManifest({
      release: parseRelease('0.2.0-beta.1'),
      publishedAt: new Date('2026-10-07T10:00:00Z'),
      notesUrl: 'https://github.com/bemmoly/bemmoly/releases/tag/v0.2.0-beta.1',
      appImage: 'ghcr.io/bemmoly/bemmoly',
      updaterImage: 'ghcr.io/bemmoly/updater',
      appDigest: digest,
      schema: [],
      config: { added: [], removed: [] },
    });
    expect(manifest).toMatchObject({
      version: '0.2.0-beta.1',
      channel: 'beta',
      publishedAt: '2026-10-07T10:00:00.000Z',
      images: {
        app: { ref: 'ghcr.io/bemmoly/bemmoly:0.2.0-beta.1', digest },
        updater: { ref: 'ghcr.io/bemmoly/updater:0.2.0-beta.1', digest: null },
      },
      rollback: 'code',
    });
    expect(() =>
      buildManifest({
        release: parseRelease('0.2.0'),
        publishedAt: new Date(),
        notesUrl: 'x',
        appImage: 'a',
        updaterImage: 'u',
        appDigest: 'latest',
        schema: [],
        config: { added: [], removed: [] },
      }),
    ).toThrow(/not an image digest/);
  });
});
