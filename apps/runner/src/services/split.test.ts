import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { JOB_TOKEN_HEADER } from '@bemmoly/module-pipelines/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeControlPlane } from '../../test/fake-control-plane.ts';
import { ControlPlaneClient } from '../clients/control-plane.ts';
import { createLogger } from '../config/logger.ts';
import { splitFiles } from './split.ts';

const JOB_ID = '0190a0a0-0000-7000-8000-000000000001';
const MAIN = path.resolve(import.meta.dirname, '../main.ts');

let server: FakeControlPlane;
let cwd: string;

beforeEach(async () => {
  server = await new FakeControlPlane().start();
  cwd = await mkdtemp(path.join(tmpdir(), 'bemmoly-split-'));
  for (const file of [
    'b.test.ts',
    'a.test.ts',
    'sub/c.test.ts',
    'sub/d.test.ts',
    'node_modules/x/e.test.ts',
  ]) {
    await mkdir(path.dirname(path.join(cwd, file)), { recursive: true });
    await writeFile(path.join(cwd, file), '');
  }
});

afterEach(async () => {
  await server.stop();
  await rm(cwd, { recursive: true, force: true });
});

describe('bemmoly-runner split', () => {
  it('sends the sorted, de-duplicated matches and returns this shard part', async () => {
    const client = new ControlPlaneClient({ url: server.url, logger: createLogger('silent') });
    const config = {
      BEMMOLY_API_URL: server.url,
      BEMMOLY_JOB_ID: JOB_ID,
      BEMMOLY_JOB_TOKEN: 'job-tok',
    };
    const files = await splitFiles(['**/*.test.ts', 'a.test.ts'], cwd, config, client);
    const call = server.of('/splits')[0]!;
    expect(call.path).toBe(`/jobs/${JOB_ID}/splits`);
    expect(call.headers[JOB_TOKEN_HEADER]).toBe('job-tok');
    expect(call.body).toEqual({
      files: ['a.test.ts', 'b.test.ts', 'sub/c.test.ts', 'sub/d.test.ts'],
    });
    expect(files).toEqual(['a.test.ts', 'sub/c.test.ts']);
  });

  it('prints one file per line from the command line', async () => {
    const { stdout } = await promisify(execFile)(process.execPath, [MAIN, 'split', 'sub/*.ts'], {
      cwd,
      env: {
        BEMMOLY_API_URL: server.url,
        BEMMOLY_JOB_ID: JOB_ID,
        BEMMOLY_JOB_TOKEN: 'job-tok',
        LOG_LEVEL: 'error',
      },
    });
    expect(stdout).toBe('sub/c.test.ts\n');
  });
});
