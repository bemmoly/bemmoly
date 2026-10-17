import { createHmac } from 'node:crypto';
import { z } from 'zod';

/*
 * The external webhook gate's HTTP call: POST the release facts, signed, and read back
 * allow or deny with a reason. The signature is an HMAC-SHA256 over "<timestamp>.<body>"
 * so the receiver can refuse replays; the call has a hard timeout and never follows
 * redirects. Any other answer is a failure the gate reports as pending.
 */

export const webhookAnswerSchema = z.object({
  allow: z.boolean(),
  reason: z.string().max(500),
});

export type WebhookAnswer = z.infer<typeof webhookAnswerSchema>;

export interface WebhookRequest {
  url: string;
  secret: string;
  timeoutMs: number;
  body: Record<string, unknown>;
  now?: Date;
}

export function signWebhook(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

export async function postWebhookGate(
  request: WebhookRequest,
  send: typeof fetch = fetch,
): Promise<WebhookAnswer> {
  const body = JSON.stringify(request.body);
  const timestamp = String(Math.floor((request.now ?? new Date()).getTime() / 1000));
  const response = await send(request.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-bemmoly-timestamp': timestamp,
      'x-bemmoly-signature': signWebhook(request.secret, timestamp, body),
    },
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(request.timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`The gate answered ${response.status}`);
  if (text.length > 64 * 1024) throw new Error('The gate answered with too much');
  return webhookAnswerSchema.parse(JSON.parse(text));
}
