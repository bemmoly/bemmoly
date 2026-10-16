import type { SqlExecutor } from '@bemmoly/core';
import type { Gate, GateState } from '../../../../../shared/promotions.ts';
import type { ShippingApplicationRow, ShippingEnvironmentRow } from '../../../models/shipping.ts';
import type { ReleaseRow } from '../../../models/shipping.ts';
import type { MetricsPart } from '../../providers/contract.ts';
import type { DeployTarget } from '../../providers/contract.ts';
import type { ShippingRequirements } from '../access.ts';

/*
 * Gates (architecture §11): evaluate(release, environment) → pass | fail | pending(reason,
 * recheckAt). A gate is one file implementing this interface plus one line in the registry.
 * A fact that is unavailable is pending with its reason, never pass.
 */

export interface GateOutcome {
  state: GateState;
  reason: string;
  evidence?: Record<string, unknown>;
  recheckAt?: Date | null;
}

/** Everything a gate may look at, read once per evaluation. */
export interface GateFacts {
  now: Date;
  promotion: {
    id: string;
    requestedBy: string | null;
    releaseDigest: string;
    freezeOverride: { by: string; byName: string; reason: string } | null;
  };
  release: ReleaseRow;
  application: ShippingApplicationRow;
  environment: ShippingEnvironmentRow;
  requirements: ShippingRequirements;
}

export interface GateDeps {
  sql: SqlExecutor;
  /** The target's metrics, when its provider has any. */
  metrics: { part: MetricsPart; target: DeployTarget } | null;
  /** Calls a webhook gate's service; injected so tests need no network. */
  webhook: WebhookCaller;
}

export interface WebhookCaller {
  call(input: {
    key: string;
    facts: Record<string, unknown>;
    sql: SqlExecutor;
  }): Promise<GateOutcome>;
}

export interface GateDefinition {
  name: Gate;
  label(args: readonly string[]): string;
  evaluate(facts: GateFacts, args: readonly string[], deps: GateDeps): Promise<GateOutcome>;
}

/** `staging_healthy("30m")` → name and arguments. */
export function parseGateCall(text: string): { name: string; args: string[] } {
  const match = /^\s*([a-z_]+)\s*(?:\((.*)\))?\s*$/.exec(text);
  if (!match) return { name: text.trim(), args: [] };
  const args = (match[2] ?? '')
    .split(',')
    .map((arg) => arg.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
  return { name: match[1] ?? text, args };
}

/** "30m", "2h", "45" (minutes) → minutes. */
export function durationMinutes(text: string | undefined, fallback: number): number {
  if (!text) return fallback;
  const match = /^(\d+)\s*(m|h|d)?$/.exec(text.trim());
  if (!match) return fallback;
  const value = Number(match[1]);
  const unit = match[2] ?? 'm';
  return unit === 'h' ? value * 60 : unit === 'd' ? value * 1440 : value;
}
