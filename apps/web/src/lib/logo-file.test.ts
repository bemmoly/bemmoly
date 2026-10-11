import { describe, expect, it } from 'vitest';
import { logoFileProblem, type Measure } from './logo-file.ts';

const sized =
  (width: number, height: number): Measure =>
  async () => ({ width, height });
const file = (name: string, type: string, size = 2048) =>
  new File([new Uint8Array(size)], name, { type });

describe('logoFileProblem', () => {
  it('passes a square PNG and an SVG without a size', async () => {
    expect(await logoFileProblem(file('a.png', 'image/png'), sized(256, 256))).toBeNull();
    expect(await logoFileProblem(file('a.svg', 'image/svg+xml'), sized(0, 0))).toBeNull();
  });

  it('names the wrong type, size and shape in words', async () => {
    expect(await logoFileProblem(file('a.gif', 'image/gif'), sized(256, 256))).toMatch(
      /not a PNG, SVG or WebP/,
    );
    expect(
      await logoFileProblem(file('a.png', 'image/png', 2 * 1024 * 1024), sized(256, 256)),
    ).toMatch(/2\.0 MB; the logo can be up to 1 MB/);
    expect(await logoFileProblem(file('a.png', 'image/png'), sized(64, 64))).toMatch(
      /at least 128 × 128/,
    );
    expect(await logoFileProblem(file('a.webp', 'image/webp'), sized(600, 200))).toMatch(
      /square or nearly square/,
    );
    expect(await logoFileProblem(file('a.png', 'image/png'), async () => null)).toMatch(
      /could not be read/,
    );
  });
});
