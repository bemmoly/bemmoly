import type { SqlClient } from '@bemmoly/core';
import type { DeployVariable } from '../providers/contract.ts';
import type { ProviderRegistry } from '../providers/registry.ts';

/** A fixed registry, or one read per call so the simulate setting takes effect live. */
export type ProviderSourceOrRegistry = ProviderRegistry | (() => Promise<ProviderRegistry>);
import type { ShippingAccess } from './access.ts';
import type { WebhookCaller } from './gates/contract.ts';

/*
 * What the promotion and rollout engines run on. The clock and the wake-up are injected so
 * tests drive a whole canary minute by minute without waiting, and production wakes through
 * pg-boss with a sweep behind it in case a wake-up is lost.
 */

export type WakeKind = 'deployment' | 'promotion';
export type Waker = (kind: WakeKind, id: string, at: Date) => Promise<void>;

export interface RolledBackEvent {
  deploymentId: string;
  applicationId: string;
  environmentId: string;
  reason: string;
  automatic: boolean;
}

export interface ShippingEngineDeps {
  sql: SqlClient;
  providers: ProviderSourceOrRegistry;
  access: ShippingAccess;
  webhook: WebhookCaller;
  now: () => Date;
  wake: Waker;
  /** The variables a deploy runs with; absent, revisions keep whatever they had. */
  variables?: (applicationId: string, environmentId: string) => Promise<DeployVariable[]>;
  /** Told after a roll back commits, so other modules (an incident in Work) can react. */
  onRolledBack?: (event: RolledBackEvent) => Promise<void>;
}

/** How long a claimed engine step may run before another worker may take it over. */
export const LEASE_MS = 2 * 60_000;
