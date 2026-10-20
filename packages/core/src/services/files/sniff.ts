import type { UploadDocumentType, UploadFileType, UploadImageType } from '@bemmoly/shared';

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
const PDF = ascii('%PDF-');

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

export type SniffedFile =
  | { kind: 'image'; mime: UploadImageType }
  | { kind: 'document'; mime: UploadDocumentType }
  | { kind: 'svg' }
  | { kind: 'other' };

/** The whole file as UTF-8 text, or null when it is not text (bad UTF-8 or a NUL byte). */
function utf8(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return text.includes('\u0000') ? null : text;
  } catch {
    return null;
  }
}

/** The start of the markup after a BOM, whitespace and leading comments, lower-cased. */
function markupHead(text: string): string {
  return text
    .slice(0, 4096)
    .replace(/^\uFEFF/, '')
    .replace(/^(\s*<!--[\s\S]*?-->)*\s*/, '')
    .toLowerCase();
}

/**
 * What a file is, for targets that take documents too. HTML has no signature, so it is text
 * that opens as a document (`<!doctype html>` or `<html>`), or text with markup sent under an
 * .html name (an inline chart is SVG inside it, and HTML is only ever served sandboxed). A
 * bare SVG stays refused: it would be drawn as an image, where the sandbox cannot reach.
 */
export function sniffFile(bytes: Uint8Array, name: string | undefined): SniffedFile {
  if (startsWith(bytes, PDF)) return { kind: 'document', mime: 'application/pdf' };
  const image = sniffImage(bytes);
  if (image.kind === 'image') return image;
  const text = utf8(bytes);
  if (text === null) return { kind: 'other' };
  const head = markupHead(text);
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    return { kind: 'document', mime: 'text/html' };
  }
  if (/\.html?$/i.test(name ?? '') && /<[a-z!]/i.test(text)) {
    return { kind: 'document', mime: 'text/html' };
  }
  return image.kind === 'svg' ? image : { kind: 'other' };
}

const EXTENSIONS: Record<UploadFileType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/html': 'html',
};

/**
 * A name safe to keep and to put in a header: the last path segment, without control
 * characters, ending in the extension of what the bytes are.
 */
export function safeFileName(name: string | undefined, mime: UploadFileType): string {
  const base = (name ?? '')
    .split(/[\\/]/)
    .pop()!
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .slice(0, 200);
  return `${base || (mime.startsWith('image/') ? 'image' : 'file')}.${EXTENSIONS[mime]}`;
}
