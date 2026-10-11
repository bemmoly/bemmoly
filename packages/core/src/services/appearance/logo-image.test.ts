import { ValidationError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { checkLogo } from './logo-image.ts';

/** A PNG header naming its size; the logo check reads nothing past it. */
function pngOf(width: number, height: number): Buffer {
  const header = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return header;
}

function webpX(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(30);
  bytes.write('RIFF', 0, 'ascii');
  bytes.write('WEBP', 8, 'ascii');
  bytes.write('VP8X', 12, 'ascii');
  bytes.writeUIntLE(width - 1, 24, 3);
  bytes.writeUIntLE(height - 1, 27, 3);
  return bytes;
}

const svg = (body: string) => Buffer.from(body, 'utf8');

function reasonOf(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return ((error as ValidationError).details as { reason: string }).reason;
  }
  throw new Error('expected the logo to be refused');
}

describe('checkLogo', () => {
  it('accepts a square PNG and WebP and reads their size from the header', () => {
    expect(checkLogo(pngOf(256, 256))).toMatchObject({ mime: 'image/png', width: 256 });
    expect(checkLogo(webpX(200, 180))).toMatchObject({
      mime: 'image/webp',
      width: 200,
      height: 180,
    });
  });

  it('refuses rasters under 128 px, far from square, or unreadable', () => {
    expect(reasonOf(() => checkLogo(pngOf(64, 64)))).toBe('too_small');
    expect(reasonOf(() => checkLogo(pngOf(512, 128)))).toBe('not_square');
    expect(reasonOf(() => checkLogo(pngOf(0, 0)))).toBe('unreadable');
  });

  it('refuses empty, oversized and non-image files', () => {
    expect(reasonOf(() => checkLogo(Buffer.alloc(0)))).toBe('empty');
    expect(reasonOf(() => checkLogo(pngOf(256, 256), 10))).toBe('too_large');
    expect(reasonOf(() => checkLogo(Buffer.from('GIF89a......')))).toBe('unsupported_type');
  });

  it('keeps a plain SVG without its prolog and checks its viewBox shape', () => {
    const checked = checkLogo(
      svg(
        '<?xml version="1.0"?>\n<!-- Generator: Tool -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x">\n' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24z"/></svg>',
      ),
    );
    expect(checked.mime).toBe('image/svg+xml');
    expect(checked.body.toString()).toMatch(/^<svg /);
    expect(checked.width).toBeNull();
    expect(
      reasonOf(() =>
        checkLogo(svg('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"></svg>')),
      ),
    ).toBe('not_square');
  });

  it.each([
    '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>',
    '<svg viewBox="0 0 1 1" onload="alert(1)"></svg>',
    '<svg viewBox="0 0 1 1"><a href="https://evil.test"><path/></a></svg>',
    '<svg viewBox="0 0 1 1"><image href="https://evil.test/x.png"/></svg>',
    '<svg viewBox="0 0 1 1"><foreignObject><div/></foreignObject></svg>',
    '<svg viewBox="0 0 1 1" style="fill:url(https://evil.test)"></svg>',
    '<!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 1 1">&x;</svg>',
  ])('refuses active or reaching SVG: %s', (body) => {
    expect(reasonOf(() => checkLogo(svg(body)))).toBe('unsafe_svg');
  });
});
