import { DEFAULT_UPLOAD_MAX_BYTES, type UploadedFile, type UploadFileType } from '@bemmoly/shared';
import { bypass, http, HttpResponse, type AnyHandler } from 'msw';
import type { MockApi } from './dispatch.ts';
import { isMissingRoute } from './msw.ts';

/*
 * POST /api/v1/files in the dev mock: the file never leaves the page. It is checked the way
 * the server checks it (signed in, its first bytes, its size) and answered with a blob: URL
 * of the file, which the page draws until it is reloaded.
 */

const SIGNATURES: [UploadFileType, number[], number?][] = [
  ['image/png', [0x89, 0x50, 0x4e, 0x47]],
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['image/gif', [0x47, 0x49, 0x46, 0x38]],
  ['image/webp', [0x57, 0x45, 0x42, 0x50], 8],
  ['application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d]],
];

/** HTML the way the server reads it, roughly: text that opens as markup, or an .html name. */
function looksLikeHtml(bytes: Uint8Array, name: string): boolean {
  const head = new TextDecoder().decode(bytes.subarray(0, 2048)).trimStart().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html') || /\.html?$/i.test(name);
}

function sniff(bytes: Uint8Array, name: string): UploadFileType | null {
  const match = SIGNATURES.find(([, signature, offset = 0]) =>
    signature.every((byte, index) => bytes[offset + index] === byte),
  );
  return match?.[0] ?? (looksLikeHtml(bytes, name) ? 'text/html' : null);
}

/** Every file the mock has stored this session, so a page can be made of one. */
export const mockFiles = new Map<string, UploadedFile>();

const refuse = (status: number, code: string, message: string, details?: object) =>
  HttpResponse.json(
    { code, message, requestId: 'mock', ...(details ? { details } : {}) },
    { status },
  );

export function mockUploadHandler(api: MockApi, fallback: boolean): AnyHandler {
  return http.post(/\/api\/v1\/files$/, async ({ request }) => {
    if (fallback) {
      const real = await fetch(bypass(request.clone())).catch(() => null);
      if (real && !(await isMissingRoute(real))) return real;
    }
    if (!api.db.signedInAs) return refuse(401, 'unauthenticated', 'Sign in to continue.');
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > DEFAULT_UPLOAD_MAX_BYTES) {
      return refuse(413, 'payload_too_large', 'The file is too large');
    }
    const name = new URL(request.url).searchParams.get('name') || 'file';
    const mime = sniff(bytes, name);
    if (!mime) {
      return refuse(400, 'validation_failed', 'Only images, PDF and HTML files can be added', {
        reason: 'unsupported_type',
      });
    }
    const body: UploadedFile = {
      id: crypto.randomUUID(),
      url: URL.createObjectURL(new Blob([bytes], { type: mime })),
      name,
      mime,
      size: bytes.byteLength,
    };
    mockFiles.set(body.id, body);
    return HttpResponse.json(body, { status: 201 });
  });
}
