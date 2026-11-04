import { describe, expect, it } from 'vitest';
import { readReach } from './reach-draft.ts';

describe('what Bemmoly can reach', () => {
  it('reads a folder ID as a folder', () => {
    expect(readReach({ kind: 'folder', folder: ' 417302018845 ', projects: '' })).toEqual({
      ok: true,
      reach: { kind: 'folder', parent: 'folders/417302018845' },
    });
    expect(readReach({ kind: 'folder', folder: 'my folder', projects: '' })).toEqual({
      ok: false,
      problem: 'folder',
    });
  });

  it('reads picked projects and names the one that is not a project ID', () => {
    expect(
      readReach({ kind: 'projects', folder: '', projects: 'example-dev, example-prod' }),
    ).toEqual({
      ok: true,
      reach: { kind: 'projects', projects: ['example-dev', 'example-prod'] },
    });
    expect(readReach({ kind: 'projects', folder: '', projects: 'example-dev Bad_Id' })).toEqual({
      ok: false,
      problem: { project: 'Bad_Id' },
    });
  });
});
