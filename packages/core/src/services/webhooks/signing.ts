import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { WEBHOOK_SIGNATURE_TOLERANCE_SECONDS } from '@bemmoly/shared/webhooks';

/** The sealed secret's associated data, so it opens only as a webhook secret. */
export const SECRET_CONTEXT = 'webhooks.secret';

const SECRET_PREFIX = 'whsec_';

export function generateWebhookSecret(): string {
  return `${SECRET_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export const secretHint = (secret: string): string => secret.slice(-4);

function digest(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/**
 * The signature header: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`. Signing
 * the timestamp with the body lets a receiver refuse a replay of an old delivery.
 */
export function signWebhook(secret: string, timestamp: number, body: string): string {
  return `t=${timestamp},v1=${digest(secret, timestamp, body)}`;
}

/** What a receiver does with the header, against the raw body, before parsing it. */
export function verifyWebhookSignature(
  secret: string,
  header: string,
  body: string,
  options: { now?: Date; toleranceSeconds?: number } = {},
): boolean {
  const parts = new Map(
    header.split(',').map((part) => {
      const [key = '', ...rest] = part.trim().split('=');
      return [key, rest.join('=')] as const;
    }),
  );
  const timestamp = Number(parts.get('t'));
  const signature = parts.get('v1');
  if (!Number.isInteger(timestamp) || !signature) return false;
  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const tolerance = options.toleranceSeconds ?? WEBHOOK_SIGNATURE_TOLERANCE_SECONDS;
  if (Math.abs(now - timestamp) > tolerance) return false;
  const expected = Buffer.from(digest(secret, timestamp, body), 'hex');
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
