import type { SqlExecutor } from '@bemmoly/core';
import { postWebhookGate } from '../../../clients/webhook-gate.ts';
import type { GateDefinition, GateOutcome, WebhookCaller } from './contract.ts';

/*
 * The external webhook gate: a security team plugs in OPA or anything else by answering a
 * signed POST with allow or deny. Written in policies as webhook("opa"). A timeout or a
 * malformed answer is a fact that is unavailable, so the gate waits and asks again.
 */

const RETRY_MS = 60_000;

/** Signing secrets are sealed outside this module; the resolver opens them by gate key. */
export type WebhookSecrets = (key: string, sealed: string | null) => Promise<string | null>;

export function createWebhookCaller(
  secrets: WebhookSecrets,
  send: typeof fetch = fetch,
): WebhookCaller {
  return {
    async call({
      key,
      facts,
      sql,
    }: {
      key: string;
      facts: Record<string, unknown>;
      sql: SqlExecutor;
    }) {
      const now = new Date();
      const [hook] = await sql<
        {
          name: string;
          url: string;
          secret_encrypted: string | null;
          timeout_ms: number;
          enabled: boolean;
        }[]
      >`select name, url, secret_encrypted, timeout_ms, enabled from pipeline_gate_webhooks
        where key = ${key}`;
      if (!hook || !hook.enabled) {
        return { state: 'fail', reason: `No webhook gate called "${key}" is set up` };
      }
      const secret = await secrets(key, hook.secret_encrypted);
      if (!secret) {
        return { state: 'pending', reason: `${hook.name} has no signing secret yet` };
      }
      try {
        const answer = await postWebhookGate(
          { url: hook.url, secret, timeoutMs: hook.timeout_ms, body: facts, now },
          send,
        );
        return {
          state: answer.allow ? 'pass' : 'fail',
          reason: `${hook.name}: ${answer.reason}`,
          evidence: { gate: key, allow: answer.allow },
        };
      } catch (error) {
        return {
          state: 'pending',
          reason: `${hook.name} did not answer: ${(error as Error).message}`,
          recheckAt: new Date(now.getTime() + RETRY_MS),
        } satisfies GateOutcome;
      }
    },
  };
}

export const webhookGate: GateDefinition = {
  name: 'webhook',
  label: (args) => `Check by ${args[0] ?? 'webhook'}`,
  async evaluate(facts, args, { webhook, sql }) {
    const key = args[0];
    if (!key) return { state: 'fail', reason: 'The policy names no webhook gate' };
    return webhook.call({
      key,
      sql,
      facts: {
        promotion: facts.promotion.id,
        release: {
          id: facts.release.id,
          version: facts.release.version,
          commitSha: facts.release.commit_sha,
          digest: facts.promotion.releaseDigest,
          imageDigests: facts.release.image_digests,
          tests: facts.release.test_summary,
        },
        application: { key: facts.application.key, tier: facts.application.tier },
        environment: { key: facts.environment.key, class: facts.environment.class },
        requestedBy: facts.promotion.requestedBy,
      },
    });
  },
};
