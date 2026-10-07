import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Changeset } from '../../contracts/changelog.ts';
import { decide } from './apply.ts';
import { checksumOf } from './checksum.ts';
import { loadChangelogFolder } from './discover.ts';
import { selectTargets } from './rollback.ts';
import { selectSources } from './sources.ts';
import type { HistoryRow } from './store.ts';

const noop = async () => undefined;
const base: Changeset = { id: '0001-a', author: 'a', description: 'd', up: noop, down: noop };

function row(overrides: Partial<HistoryRow>): HistoryRow {
  return {
    module: 'core',
    id: '0001-a',
    author: 'a',
    description: 'd',
    checksum: checksumOf(base),
    executedAt: new Date(0),
    executionMs: 0,
    orderExecuted: 1,
    appVersion: '1',
    contexts: ['*'],
    state: 'ran',
    tag: null,
    progress: {},
    slow: false,
    irreversible: false,
    ...overrides,
  };
}

describe('decide', () => {
  it('runs pending changesets and skips applied ones', () => {
    expect(decide('core', base, undefined, ['production'], false)).toEqual({ action: 'run' });
    expect(decide('core', base, row({}), ['production'], false).action).toBe('skip');
    expect(decide('core', base, row({ state: 'rolled_back' }), ['production'], false).action).toBe(
      'run',
    );
  });

  it('honours contexts, runAlways and runOnChange', () => {
    const demo = { ...base, contexts: ['demo'] };
    expect(decide('core', demo, undefined, ['production'], false)).toEqual({
      action: 'skip',
      reason: 'context',
    });
    expect(
      decide('core', { ...base, runAlways: true }, row({}), ['production'], false).action,
    ).toBe('run');
    const changed = row({ checksum: 'old' });
    expect(decide('core', { ...base, runOnChange: true }, changed, ['test'], false).action).toBe(
      'run',
    );
    expect(() => decide('core', base, changed, ['test'], false)).toThrow(/changed after it ran/);
  });

  it('stops on a started row unless asked to retry', () => {
    const started = row({ state: 'started' });
    expect(() => decide('core', base, started, ['production'], false)).toThrow(/never finished/);
    expect(decide('core', base, started, ['production'], true).action).toBe('run');
  });
});

describe('selectSources', () => {
  it('puts the kernel first and modules in dependency order', () => {
    const sources = selectSources(
      [],
      [
        { module: 'desk', changelog: [], dependsOn: ['work'] },
        { module: 'work', changelog: [] },
      ],
    );
    expect(sources.map((s) => s.module)).toEqual(['core', 'work', 'desk']);
    expect(() =>
      selectSources([], [{ module: 'desk', changelog: [], dependsOn: ['work'] }]),
    ).toThrow(/depends on "work"/);
    expect(() => selectSources([], [], ['nope'])).toThrow(/No changelog/);
  });
});

describe('selectTargets', () => {
  const history = [
    row({ id: '0001-a', orderExecuted: 1, tag: 'v1' }),
    row({ id: '0002-b', orderExecuted: 2 }),
    row({ module: 'work', id: '0001-w', orderExecuted: 3 }),
  ];

  it('selects by count, id and tag, newest first', () => {
    expect(selectTargets(history, 'core', { count: 1 }).map((r) => r.id)).toEqual(['0002-b']);
    expect(selectTargets(history, 'core', { toId: '0001-a' }).map((r) => r.id)).toEqual(['0002-b']);
    expect(selectTargets(history, '*', { toTag: 'v1' }).map((r) => r.id)).toEqual([
      '0001-w',
      '0002-b',
    ]);
    expect(() => selectTargets(history, 'core', { toTag: 'v9' })).toThrow(/tagged/);
  });
});

describe('loadChangelogFolder', () => {
  it('loads files in numeric order with a file checksum, and checks ids', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'changelog-'));
    const body = (id: string) =>
      `export default { id: '${id}', author: 'a', description: 'd', up: async () => {} };\n`;
    writeFileSync(join(dir, '0002-second.ts'), body('0002-second'));
    writeFileSync(join(dir, '0001-first.ts'), body('0001-first'));
    writeFileSync(join(dir, 'README.md'), '# not a changeset');
    const loaded = await loadChangelogFolder(dir);
    expect(loaded.map((c) => c.id)).toEqual(['0001-first', '0002-second']);
    expect(loaded[0]?.source?.checksum).toMatch(/^[0-9a-f]{64}$/);
    writeFileSync(join(dir, '0003-third.ts'), body('0003-wrong'));
    await expect(loadChangelogFolder(dir)).rejects.toThrow(/must match the file name/);
    expect(await loadChangelogFolder(join(dir, 'missing'))).toEqual([]);
  });
});
