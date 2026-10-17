import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { expandGlobs } from './glob.ts';

describe('expandGlobs', () => {
  let base: string;
  let workspace: string;

  beforeEach(async () => {
    base = await mkdtemp(path.join(tmpdir(), 'runner-glob-'));
    workspace = path.join(base, 'workspace');
    await mkdir(path.join(workspace, 'reports'), { recursive: true });
    await mkdir(path.join(base, 'host'), { recursive: true });
    await writeFile(path.join(base, 'host', 'credentials.json'), '{"token":"secret"}');
    await writeFile(path.join(workspace, 'reports', 'unit.xml'), '<testsuite/>');
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it('finds the files a pattern matches in the workspace', async () => {
    expect(await expandGlobs(['reports/*.xml'], workspace)).toEqual(['reports/unit.xml']);
  });

  it('never follows ../ out of the workspace', async () => {
    expect(await expandGlobs(['../host/*.json'], workspace)).toEqual([]);
  });

  it('skips a symlink a step left pointing at a file outside the workspace', async () => {
    await symlink(
      path.join(base, 'host', 'credentials.json'),
      path.join(workspace, 'reports', 'stolen.xml'),
    );
    expect(await expandGlobs(['reports/*.xml'], workspace)).toEqual(['reports/unit.xml']);
  });

  it('skips files reached through a symlinked folder outside the workspace', async () => {
    await symlink(path.join(base, 'host'), path.join(workspace, 'out'));
    expect(await expandGlobs(['out/*', 'out/**/*.json'], workspace)).toEqual([]);
  });

  it('keeps a symlink that stays inside the workspace', async () => {
    await symlink(path.join(workspace, 'reports', 'unit.xml'), path.join(workspace, 'latest.xml'));
    expect(await expandGlobs(['*.xml'], workspace)).toEqual(['latest.xml']);
  });
});
