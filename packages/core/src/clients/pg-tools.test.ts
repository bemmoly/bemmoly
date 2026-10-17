import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createPgTools } from './pg-tools.ts';

const tools = createPgTools({ binDir: '/nonexistent' });
const url = 'postgres://user@localhost/db';

describe('pg tools arguments', () => {
  it('refuses a snapshot id that is not one pg_export_snapshot() returns', async () => {
    await expect(tools.dump(url, new PassThrough(), { snapshot: '1; rm -rf /' })).rejects.toThrow(
      'Invalid snapshot id',
    );
  });

  it('refuses a job count that is not a positive integer', async () => {
    await expect(tools.restore(url, 'dump.pgc', { jobs: 0 })).rejects.toThrow('positive integer');
    await expect(tools.restore(url, 'dump.pgc', { jobs: 1.5 })).rejects.toThrow('positive integer');
  });
});
