import { describe, expect, it } from 'vitest';
import { safeFileName, sniffFile, sniffImage } from './sniff.ts';

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

describe('sniffFile', () => {
  it('reads PDFs by signature and HTML by how it opens', () => {
    expect(sniffFile(text('%PDF-1.7\n...'), 'x.png')).toEqual({
      kind: 'document',
      mime: 'application/pdf',
    });
    expect(sniffFile(text('\uFEFF\n<!DOCTYPE html><title>x</title>'), undefined)).toMatchObject({
      mime: 'text/html',
    });
    expect(sniffFile(text('<!-- made by an agent -->\n<html lang="en">'), 'a.txt')).toMatchObject({
      mime: 'text/html',
    });
  });

  it('takes markup without a doctype only under an .html name', () => {
    expect(sniffFile(text('<div><svg></svg></div>'), 'chart.html')).toMatchObject({
      mime: 'text/html',
    });
    expect(sniffFile(text('<div>hi</div>'), 'notes.txt')).toEqual({ kind: 'other' });
    expect(sniffFile(text('plain words'), 'notes.html')).toEqual({ kind: 'other' });
  });

  it('keeps images first and refuses SVG and binary', () => {
    expect(sniffFile(bytes(0xff, 0xd8, 0xff, 0xe0), 'a.html')).toMatchObject({
      mime: 'image/jpeg',
    });
    expect(sniffFile(text('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'a.svg')).toEqual({
      kind: 'svg',
    });
    expect(sniffFile(bytes(0x3c, 0x68, 0x00, 0x74), 'a.html')).toEqual({ kind: 'other' });
    expect(sniffFile(bytes(0xc3, 0x28), 'a.html')).toEqual({ kind: 'other' });
  });
});

describe('safeFileName', () => {
  it('keeps the last segment and ends it in the real type', () => {
    expect(safeFileName('../../etc/passwd.svg', 'image/png')).toBe('passwd.png');
    expect(safeFileName('C:\\shots\\Screen Shot.PNG', 'image/jpeg')).toBe('Screen Shot.jpg');
    expect(safeFileName('a\u0000b\u001f.gif', 'image/gif')).toBe('ab.gif');
    expect(safeFileName(undefined, 'image/webp')).toBe('image.webp');
    expect(safeFileName('.png', 'image/png')).toBe('image.png');
    expect(safeFileName('Q3 report.htm', 'text/html')).toBe('Q3 report.html');
    expect(safeFileName('', 'application/pdf')).toBe('file.pdf');
  });
});
