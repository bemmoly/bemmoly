import type { UploadImageType } from '@bemmoly/shared';

/*
 * What an upload really is, read from its first bytes. The name, the extension and the
 * Content-Type a browser sends are all chosen by the sender, so none of them decides what
 * the files API stores or the Content-Type it later serves.
 */

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((byte, index) => bytes[offset + index] === byte);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const GIF87 = ascii('GIF87a');
const GIF89 = ascii('GIF89a');
const RIFF = ascii('RIFF');
const WEBP = ascii('WEBP');

export type Sniffed =
  { kind: 'image'; mime: UploadImageType } | { kind: 'svg' } | { kind: 'other' };

/** True when the start of the file reads as XML or SVG markup (after a BOM and whitespace). */
function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, 1024))
    .replace(/^\uFEFF/, '')
    .trimStart()
    .toLowerCase();
  return head.startsWith('<?xml') || head.startsWith('<svg') || head.includes('<svg');
}

export function sniffImage(bytes: Uint8Array): Sniffed {
  if (startsWith(bytes, PNG)) return { kind: 'image', mime: 'image/png' };
  if (startsWith(bytes, JPEG)) return { kind: 'image', mime: 'image/jpeg' };
  if (startsWith(bytes, GIF87) || startsWith(bytes, GIF89)) {
    return { kind: 'image', mime: 'image/gif' };
  }
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) {
    return { kind: 'image', mime: 'image/webp' };
  }
  if (looksLikeSvg(bytes)) return { kind: 'svg' };
  return { kind: 'other' };
}

const EXTENSIONS: Record<UploadImageType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * A name safe to keep and to put in a header: the last path segment, without control
 * characters, ending in the extension of what the bytes are.
 */
export function safeFileName(name: string | undefined, mime: UploadImageType): string {
  const base = (name ?? '')
    .split(/[\\/]/)
    .pop()!
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .slice(0, 200);
  return `${base || 'image'}.${EXTENSIONS[mime]}`;
}
