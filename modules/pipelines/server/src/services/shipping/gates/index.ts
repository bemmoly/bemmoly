import type { Gate, GateResult } from '../../../../../shared/promotions.ts';
import type { GateDefinition, GateDeps, GateFacts, GateOutcome } from './contract.ts';
import { parseGateCall } from './contract.ts';
import {
  errorBudgetGate,
  freezeGate,
  stagingHealthyGate,
  windowGate,
} from './environment-gates.ts';
import { externalChecksGate, securityScanGate, testsGate } from './release-gates.ts';
import { webhookGate } from './webhook.ts';

export type { GateDeps, GateFacts, GateOutcome } from './contract.ts';
export { createWebhookCaller, type WebhookSecrets } from './webhook.ts';

/*
 * The gate registry and one evaluation pass. Policies name gates as calls; the freeze and
 * window gates always apply, because they hold whatever any policy says; approvals are
 * judged separately, since they wait on people rather than facts.
 */

const GATES: readonly GateDefinition[] = [
  testsGate,
  externalChecksGate,
  securityScanGate,
  stagingHealthyGate,
  windowGate,
  freezeGate,
  errorBudgetGate,
  webhookGate,
];

const byName = new Map<string, GateDefinition>([
  ...GATES.map((gate) => [gate.name, gate] as const),
  // Policies name one required check as external_check("security.yml").
  ['external_check', externalChecksGate],
]);

export interface EvaluatedGate extends GateResult {
  /** The gate as the policy wrote it, so two webhook gates stay apart. */
  key: string;
}

/** A stored result's key ("staging_healthy:30m") as the gate and label a person reads. */
export function describeStoredGate(key: string): { gate: Gate; label: string } {
  if (key === 'approvals') return { gate: 'approvals', label: 'Approvals' };
  if (key === 'canary') return { gate: 'canary', label: 'Canary' };
  const at = key.indexOf(':');
  const name = at < 0 ? key : key.slice(0, at);
  const args = at < 0 ? [] : key.slice(at + 1).split(',');
  const gate = byName.get(name);
  return gate ? { gate: gate.name, label: gate.label(args) } : { gate: 'custom', label: name };
}

/** The gates a promotion is held to, in the order a person reads them. */
export function gateCalls(policyGates: readonly string[]): string[] {
  const calls = [...new Set(policyGates.map((text) => text.trim()).filter(Boolean))];
  for (const always of ['window', 'freeze']) {
    if (!calls.some((call) => parseGateCall(call).name === always)) calls.push(always);
  }
  return calls;
}

export async function evaluateGates(
  calls: readonly string[],
  facts: GateFacts,
  deps: GateDeps,
): Promise<EvaluatedGate[]> {
  const results: EvaluatedGate[] = [];
  for (const call of calls) {
    const { name, args } = parseGateCall(call);
    const gate = byName.get(name);
    let outcome: GateOutcome;
    if (!gate) {
      outcome = {
        state: 'fail',
        reason: `The policy names a gate Pipelines does not know: ${name}`,
      };
    } else {
      try {
        outcome = await gate.evaluate(facts, args, deps);
      } catch (error) {
        // A gate that cannot answer holds the promotion; it never lets it through.
        outcome = {
          state: 'pending',
          reason: `Could not check: ${(error as Error).message}`,
          recheckAt: new Date(facts.now.getTime() + 60_000),
        };
      }
    }
    results.push({
      key: args.length > 0 ? `${name}:${args.join(',')}` : name,
      gate: (gate?.name ?? 'custom') as Gate,
      label: gate ? gate.label(args) : name,
      state: outcome.state,
      reason: outcome.reason,
      evidence: outcome.evidence ?? {},
      recheckAt: outcome.recheckAt ? outcome.recheckAt.toISOString() : null,
      evaluatedAt: facts.now.toISOString(),
    });
  }
  return results;
}

/** All pass; any fail; else the earliest time worth asking again. */
export function summarise(results: readonly EvaluatedGate[]): {
  state: 'pass' | 'fail' | 'pending';
  recheckAt: Date | null;
} {
  if (results.some((r) => r.state === 'fail')) return { state: 'fail', recheckAt: null };
  const pending = results.filter((r) => r.state === 'pending');
  if (pending.length === 0) return { state: 'pass', recheckAt: null };
  const times = pending.flatMap((r) => (r.recheckAt ? [new Date(r.recheckAt).getTime()] : []));
  return { state: 'pending', recheckAt: times.length ? new Date(Math.min(...times)) : null };
}
