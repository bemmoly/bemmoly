import { ValidationError } from '@bemmoly/shared';
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/** Who unsubscribes from what: a notification kind, or `digest` for the batched summary. */
export interface UnsubscribeClaim {
  userId: string;
  scope: string;
}

export const DIGEST_SCOPE = 'digest';

const claimSchema = z.object({ v: z.literal(1), u: z.string().min(1), s: z.string().min(1) });

export interface UnsubscribeSigner {
  sign(claim: UnsubscribeClaim): string;
  /** Throws ValidationError for a token that is malformed or not ours. */
  verify(token: string): UnsubscribeClaim;
}

/**
 * Tokens are a claim plus an HMAC under a key derived from the install's secret
 * key. They do not expire: an unsubscribe link in a year-old email must still work,
 * and all it can do is turn email off for one kind.
 */
export function createUnsubscribeSigner(secretKeyBase64: string): UnsubscribeSigner {
  const key = Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(secretKeyBase64, 'base64'),
      '',
      'bemmoly email unsubscribe v1',
      32,
    ),
  );
  const mac = (payload: string) => createHmac('sha256', key).update(payload).digest();
  const invalid = () =>
    new ValidationError('This unsubscribe link is not valid', { code: 'bad_request' });
  return {
    sign(claim) {
      const payload = Buffer.from(
        JSON.stringify({ v: 1, u: claim.userId, s: claim.scope }),
      ).toString('base64url');
      return `${payload}.${mac(payload).toString('base64url')}`;
    },
    verify(token) {
      const [payload, signature, extra] = token.split('.');
      if (!payload || !signature || extra !== undefined) throw invalid();
      const expected = mac(payload);
      const given = Buffer.from(signature, 'base64url');
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw invalid();
      let decoded: unknown;
      try {
        decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      } catch {
        throw invalid();
      }
      const parsed = claimSchema.safeParse(decoded);
      if (!parsed.success) throw invalid();
      return { userId: parsed.data.u, scope: parsed.data.s };
    },
  };
}

export interface UnsubscribeLinks {
  /** The web page that confirms and shows the result. */
  pageUrl: string;
  /** RFC 8058 one-click endpoint for mail clients. */
  headers: Record<string, string>;
}

export function unsubscribeLinks(publicUrl: string, token: string): UnsubscribeLinks {
  const base = publicUrl.replace(/\/+$/, '');
  const query = `token=${encodeURIComponent(token)}`;
  return {
    pageUrl: `${base}/unsubscribe?${query}`,
    headers: {
      'List-Unsubscribe': `<${base}/api/v1/email-unsubscriptions?${query}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
