import { describe, expect, it } from 'vitest';
import type { Changeset } from '../../contracts/changelog.ts';
import { checksumOf, checksumOfSource } from './checksum.ts';
import type { HistoryRow } from './store.ts';
import { historyProblems, structuralProblems } from './validate.ts';

const noop = async () => undefined;

function cs(id: string, extra: Partial<Changeset> = {}): Changeset {
  return { id, author: 'a', description: 'd', up: noop, down: noop, ...extra };
}

function row(id: string, checksum: string, state: HistoryRow['state'] = 'ran'): HistoryRow {
  return {
    module: 'work',
    id,
    author: 'a',
    description: 'd',
    checksum,
    executedAt: new Date(0),
    executionMs: 1,
    orderExecuted: 1,
    appVersion: '1',
    contexts: ['*'],
    state,
    tag: null,
    tags: [],
    progress: {},
    slow: false,
    irreversible: false,
  };
}

describe('structuralProblems', () => {
  it('accepts a contiguous changelog, and new blocks of 100', () => {
    expect(structuralProblems('work', [cs('0001-a'), cs('0002-b')])).toEqual([]);
    const blocks = ['0001-a', '0002-b', '0100-c', '0101-d', '0200-e'].map((id) => cs(id));
    expect(structuralProblems('core', blocks)).toEqual([]);
    expect(structuralProblems('core', [cs('0001-a'), cs('0102-c')])[0]?.problem).toBe(
      'gap_in_order',
    );
  });

  it('reports gaps, duplicates, bad ids and a missing down', () => {
    const problems = structuralProblems('work', [
      cs('0001-a'),
      cs('0003-c'),
      cs('0003-again'),
      cs('7-bad'),
      cs('0004-d', { down: undefined }),
      cs('0005-e', { down: undefined, irreversible: true }),
    ]);
    expect(problems.map((p) => [p.id, p.problem])).toEqual([
      ['0003-c', 'gap_in_order'],
      ['0003-again', 'duplicate_id'],
      ['7-bad', 'invalid_id'],
      ['0004-d', 'missing_down'],
    ]);
  });
});

describe('historyProblems', () => {
  const changeset = cs('0001-a', { source: { file: 'f.ts', checksum: 'new' } });

  it('reports a changed checksum, but not one listed in validChecksums', () => {
    expect(historyProblems('work', [changeset], [row('0001-a', 'old')])[0]?.problem).toBe(
      'checksum_mismatch',
    );
    const allowed = { ...changeset, validChecksums: [{ checksum: 'old', reason: 'typo' }] };
    expect(historyProblems('work', [allowed], [row('0001-a', 'old')])).toEqual([]);
  });

  it('relaxes the rule for runOnChange and ignores rolled back rows', () => {
    expect(
      historyProblems('work', [{ ...changeset, runOnChange: true }], [row('0001-a', 'old')]),
    ).toEqual([]);
    expect(historyProblems('work', [changeset], [row('0001-a', 'old', 'rolled_back')])).toEqual([]);
  });

  it('warns about rows a newer release wrote', () => {
    const [problem] = historyProblems('work', [], [row('0009-z', 'x')]);
    expect(problem).toMatchObject({ problem: 'unknown_changeset', severity: 'warning' });
  });
});

describe('checksums', () => {
  it('normalises line endings and hashes inline changesets by their code', () => {
    expect(checksumOfSource('a\r\nb')).toBe(checksumOfSource('a\nb'));
    const a = cs('0001-a', { up: async () => undefined });
    const b = cs('0001-a', { up: async () => void 'changed' });
    expect(checksumOf(a)).not.toBe(checksumOf(b));
    expect(checksumOf({ ...a, source: { file: 'x', checksum: 'fixed' } })).toBe('fixed');
  });
});
