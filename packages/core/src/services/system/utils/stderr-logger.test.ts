import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createStderrLogger } from './stderr-logger.ts';

function capture() {
  let text = '';
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      text += chunk.toString();
      done();
    },
  });
  return { stream, text: () => text };
}

const config = { LOG_LEVEL: 'warn', LOG_FORMAT: 'json' } as const;

describe('the command-line logger', () => {
  it('writes readable lines for a person', () => {
    const out = capture();
    const logger = createStderrLogger(config, { human: true, stream: out.stream });
    logger.warn({ set: 'bemmoly-20261008-manual' }, 'database replaced by a backup');
    expect(out.text()).toMatch(/WARN.*: database replaced by a backup\n/);
    expect(out.text()).toContain('set: "bemmoly-20261008-manual"');
    expect(out.text()).not.toContain('{"level"');
  });

  it('writes JSON lines for a program', () => {
    const out = capture();
    const logger = createStderrLogger(config, { human: false, stream: out.stream });
    logger.warn({ set: 'bemmoly-20261008-manual' }, 'database replaced by a backup');
    expect(JSON.parse(out.text())).toMatchObject({
      level: 40,
      msg: 'database replaced by a backup',
      set: 'bemmoly-20261008-manual',
    });
  });
});
