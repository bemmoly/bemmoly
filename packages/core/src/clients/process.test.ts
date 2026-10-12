import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { ProcessError, runProcess } from './process.ts';

/** Far more than a pipe buffer, so the writer is still going when the reader leaves. */
function endless(): Readable {
  const chunk = Buffer.alloc(64 * 1024, 1);
  let sent = 0;
  return new Readable({
    read() {
      sent += 1;
      this.push(sent > 512 ? null : chunk);
    },
  });
}

describe('runProcess', () => {
  it('succeeds when the program stops reading stdin early and exits 0', async () => {
    // tar -x stops at the end-of-archive blocks and exits without reading what follows.
    for (let i = 0; i < 5; i += 1) {
      await expect(
        runProcess('/bin/sh', ['-c', 'head -c 1 > /dev/null'], {
          timeoutMs: 10_000,
          stdin: endless(),
        }),
      ).resolves.toMatchObject({ stderr: '' });
    }
  });

  it('still reports a failed exit when stdin was cut off', async () => {
    await expect(
      runProcess('/bin/sh', ['-c', 'head -c 1 > /dev/null; exit 3'], {
        timeoutMs: 10_000,
        stdin: endless(),
      }),
    ).rejects.toBeInstanceOf(ProcessError);
  });
});
