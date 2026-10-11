import {
  LOGO_EXTENSIONS,
  LOGO_MAX_BYTES,
  LOGO_MAX_RATIO,
  LOGO_MIN_PX,
  LOGO_PATH_PREFIX,
  type LogoType,
  type WorkspaceLogo,
} from '@bemmoly/shared';
import { audit, can, type MockDb } from './db.ts';
import { fail, ok, type MockResponse, type MockRoute } from './types.ts';

/*
 * The workspace logo in the dev mock, the demo and Playwright. It is checked the way the server
 * checks it (permission, type, size, shape, nothing active in an SVG), kept in the mock with its
 * bytes, and served from the same kind of path the server uses. The upload and the served file
 * are bytes, which the JSON dispatcher cannot carry, so msw.ts and e2e/support call
 * uploadLogo and servedLogo themselves.
 */

export const LOGO_UPLOAD_PATH = /\/api\/v1\/workspace\/logo$/;
export const LOGO_FILE_PATH = /\/api\/v1\/workspace\/logo\/[^/]+$/;

const refuse = (message: string, reason: string) =>
  fail(400, 'validation_failed', message, { reason });

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to));

function rasterOf(bytes: Uint8Array): { mime: LogoType; width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG' && bytes.length >= 24) {
    return { mime: 'image/png', width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP' && bytes.length >= 30) {
    const chunk = ascii(bytes, 12, 16);
    if (chunk === 'VP8X') {
      const u24 = (at: number) => bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16);
      return { mime: 'image/webp', width: 1 + u24(24), height: 1 + u24(27) };
    }
    if (chunk === 'VP8 ') {
      return {
        mime: 'image/webp',
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
  }
  return null;
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(binary);
}

function check(bytes: Uint8Array): WorkspaceLogo | MockResponse {
  if (bytes.byteLength === 0) return refuse('The file is empty', 'empty');
  if (bytes.byteLength > LOGO_MAX_BYTES) return refuse('The logo is larger than 1 MB', 'too_large');
  const raster = rasterOf(bytes);
  if (raster) {
    const { width, height } = raster;
    if (Math.min(width, height) < LOGO_MIN_PX) {
      return refuse(
        `The logo must be at least ${LOGO_MIN_PX} × ${LOGO_MIN_PX} pixels`,
        'too_small',
      );
    }
    if (Math.max(width, height) / Math.min(width, height) > LOGO_MAX_RATIO) {
      return refuse('The logo must be square or nearly square', 'not_square');
    }
    return { logoKey: '', mime: raster.mime, size: bytes.byteLength, width, height };
  }
  const text = new TextDecoder().decode(bytes);
  if (!/<svg\b/i.test(text)) return refuse('Use a PNG, SVG or WebP file', 'unsupported_type');
  if (/<script|<foreignObject|\son[a-z]+\s*=|javascript:|href\s*=\s*["'](?!#)/i.test(text)) {
    return refuse('This SVG has scripts, links or other active content', 'unsafe_svg');
  }
  return {
    logoKey: '',
    mime: 'image/svg+xml',
    size: bytes.byteLength,
    width: null,
    height: null,
  };
}

function gate(db: MockDb): MockResponse | null {
  if (!db.signedInAs) return fail(401, 'unauthenticated', 'Sign in to continue.');
  if (!can(db, 'workspace.appearance.manage')) {
    return fail(403, 'forbidden', 'Only people who can set appearance can change the logo.');
  }
  return null;
}

/** A stand-in for the server's sha256: 64 hex characters that follow the bytes. */
function contentName(data: string): string {
  let hex = '';
  for (let seed = 0; hex.length < 64; seed += 1) {
    let hash = 0x811c9dc5 ^ seed;
    for (let at = 0; at < data.length; at += 1) {
      hash = Math.imul(hash ^ data.charCodeAt(at), 0x01000193);
    }
    hex += (hash >>> 0).toString(16).padStart(8, '0');
  }
  return hex;
}

/**
 * Keeps the bytes and points appearance.logoKey at the path they are served from, as the
 * server does. Earlier logos stay, so Undo after Remove finds its logo again.
 */
export function storeMockLogo(db: MockDb, mime: LogoType, bytes: Uint8Array): string {
  const data = base64(bytes);
  const file = `${contentName(data)}.${LOGO_EXTENSIONS[mime]}`;
  db.logos = { ...db.logos, [file]: { mime, data } };
  const logoKey = `${LOGO_PATH_PREFIX}${file}`;
  db.settings['appearance.logoKey'] = logoKey;
  return logoKey;
}

/** GET /api/v1/workspace/logo/:file: the current logo's bytes, or null. */
export function servedLogo(db: MockDb, url: string): { mime: string; bytes: Uint8Array } | null {
  const file = new URL(url, 'http://mock').pathname.slice(LOGO_PATH_PREFIX.length);
  const stored = db.logos?.[file];
  if (!stored || db.settings['appearance.logoKey'] !== `${LOGO_PATH_PREFIX}${file}`) return null;
  return { mime: stored.mime, bytes: Uint8Array.from(atob(stored.data), (c) => c.charCodeAt(0)) };
}

/** POST /api/v1/workspace/logo with the file's bytes. */
export function uploadLogo(db: MockDb, bytes: Uint8Array): MockResponse {
  const refused = gate(db);
  if (refused) return refused;
  const result = check(bytes);
  if ('status' in result) return result;
  const before = db.settings['appearance.logoKey'];
  result.logoKey = storeMockLogo(db, result.mime, bytes);
  audit(db, before ? 'workspace.logo_replaced' : 'workspace.logo_added', 'workspace', null);
  return ok(result, 201);
}

export const logoRoutes: MockRoute[] = [
  {
    method: 'DELETE',
    pattern: '/api/v1/workspace/logo',
    handle: (_, db) => {
      const refused = gate(db);
      if (refused) return refused;
      if (db.settings['appearance.logoKey']) {
        db.settings['appearance.logoKey'] = '';
        audit(db, 'workspace.logo_removed', 'workspace', null);
      }
      return ok();
    },
  },
];
