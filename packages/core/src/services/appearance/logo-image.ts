import {
  LOGO_MAX_BYTES,
  LOGO_MAX_RATIO,
  LOGO_MIN_PX,
  ValidationError,
  type LogoRejection,
  type LogoType,
} from '@bemmoly/shared';
import { sanitiseUploadedSvg } from '../../utils/svg.ts';

/*
 * What an uploaded logo really is, read from its bytes: the browser's name and Content-Type are
 * the sender's choice. Raster sizes come from the file header, so nothing is decoded.
 */

export interface CheckedLogo {
  mime: LogoType;
  /** The bytes to store: as sent for PNG and WebP, the checked markup for SVG. */
  body: Buffer;
  /** Pixel size for PNG and WebP; null for SVG, which scales. */
  width: number | null;
  height: number | null;
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const MESSAGES: Record<LogoRejection, string> = {
  empty: 'The file is empty',
  too_large: 'The logo is larger than 1 MB',
  unsupported_type: 'Use a PNG, SVG or WebP file',
  unsafe_svg: 'This SVG has scripts, links or other active content; export a plain SVG or a PNG',
  unreadable: 'This image could not be read',
  too_small: `The logo must be at least ${LOGO_MIN_PX} × ${LOGO_MIN_PX} pixels`,
  not_square: 'The logo must be square or nearly square',
};

export function logoError(reason: LogoRejection, details: Record<string, unknown> = {}) {
  return new ValidationError(MESSAGES[reason], { details: { reason, ...details } });
}

type Size = { width: number; height: number };

function pngSize(bytes: Buffer): Size | null {
  if (bytes.length < 24 || bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function webpSize(bytes: Buffer): Size | null {
  if (bytes.length < 30) return null;
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const [b0, b1, b2, b3] = [bytes[21]!, bytes[22]!, bytes[23]!, bytes[24]!];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  if (chunk === 'VP8X') {
    return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  }
  return null;
}

const number = (value: string | undefined) => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/** The SVG's shape from its viewBox, or from width and height when it has none. */
function svgShape(markup: string): Size | null {
  const open = /^<svg\b[^>]*>/i.exec(markup)?.[0] ?? '';
  const attr = (name: string) =>
    new RegExp(String.raw`\s${name}\s*=\s*["']([^"']*)["']`, 'i').exec(open)?.[1];
  const box = attr('viewBox')
    ?.trim()
    .split(/[\s,]+/);
  if (box?.length === 4) {
    const [width, height] = [number(box[2]), number(box[3])];
    if (width && height) return { width, height };
  }
  const [width, height] = [number(attr('width')), number(attr('height'))];
  return width && height ? { width, height } : null;
}

function assertShape(size: Size | null, raster: boolean): void {
  if (!size || size.width <= 0 || size.height <= 0) throw logoError('unreadable');
  if (raster && Math.min(size.width, size.height) < LOGO_MIN_PX) {
    throw logoError('too_small', { width: size.width, height: size.height, min: LOGO_MIN_PX });
  }
  const ratio = Math.max(size.width, size.height) / Math.min(size.width, size.height);
  if (ratio > LOGO_MAX_RATIO) {
    throw logoError('not_square', { width: size.width, height: size.height });
  }
}

/** Checks type, size and shape, and answers what to store; throws a ValidationError otherwise. */
export function checkLogo(bytes: Buffer, maxBytes = LOGO_MAX_BYTES): CheckedLogo {
  if (bytes.byteLength === 0) throw logoError('empty');
  if (bytes.byteLength > maxBytes) throw logoError('too_large', { maxBytes });
  if (bytes.subarray(0, 8).equals(PNG)) {
    const size = pngSize(bytes);
    assertShape(size, true);
    return { mime: 'image/png', body: bytes, ...size! };
  }
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const size = webpSize(bytes);
    assertShape(size, true);
    return { mime: 'image/webp', body: bytes, ...size! };
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (!/<svg\b/i.test(text.slice(0, 4096))) throw logoError('unsupported_type');
  const markup = sanitiseUploadedSvg(text);
  if (!markup) throw logoError('unsafe_svg');
  assertShape(svgShape(markup), false);
  return { mime: 'image/svg+xml', body: Buffer.from(markup, 'utf8'), width: null, height: null };
}
