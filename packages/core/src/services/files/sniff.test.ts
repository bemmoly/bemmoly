import { describe, expect, it } from 'vitest';
import { safeFileName, sniffImage } from './sniff.ts';

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe('sniffImage', () => {
  it('reads each accepted image type from its signature', () => {
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toEqual({
      kind: 'image',
      mime: 'image/png',
    });
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toMatchObject({ mime: 'image/jpeg' });
    expect(sniffImage(text('GIF89a....'))).toMatchObject({ mime: 'image/gif' });
    expect(sniffImage(text('GIF87a....'))).toMatchObject({ mime: 'image/gif' });
    expect(sniffImage(text('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '))).toMatchObject({
      mime: 'image/webp',
    });
  });

  it('tells SVG apart, with or without a prolog, BOM or leading space', () => {
    expect(sniffImage(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toEqual({ kind: 'svg' });
    expect(sniffImage(text('\uFEFF  <?xml version="1.0"?><svg/>'))).toEqual({ kind: 'svg' });
    expect(sniffImage(text('<!-- hi --><svg/>'))).toEqual({ kind: 'svg' });
  });

  it('refuses everything else, whatever it claims to be', () => {
    expect(sniffImage(text('<html><script>1</script>'))).toEqual({ kind: 'other' });
    expect(sniffImage(text('RIFF....AVI '))).toEqual({ kind: 'other' });
    expect(sniffImage(bytes(0x89, 0x50))).toEqual({ kind: 'other' });
    expect(sniffImage(new Uint8Array())).toEqual({ kind: 'other' });
  });
});

describe('safeFileName', () => {
  it('keeps the last segment and ends it in the real type', () => {
    expect(safeFileName('../../etc/passwd.svg', 'image/png')).toBe('passwd.png');
    expect(safeFileName('C:\\shots\\Screen Shot.PNG', 'image/jpeg')).toBe('Screen Shot.jpg');
    expect(safeFileName('a\u0000b\u001f.gif', 'image/gif')).toBe('ab.gif');
    expect(safeFileName(undefined, 'image/webp')).toBe('image.webp');
    expect(safeFileName('.png', 'image/png')).toBe('image.png');
  });
});
