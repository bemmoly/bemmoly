import type { PlanBilling } from '../../../../shared/landing-zones.ts';
import type { CloudProvider, ConnectionRecord, DesiredResource } from '../providers/contract.ts';
import type { DesiredZone } from './layout.ts';
import { statusOf, type RecordedResource } from './tree.ts';

/*
 * The billing check before anything starts. No cloud says how many projects a billing account
 * may pay for, so the plan counts what it pays for now and what this plan adds, and warns
 * when the total passes the limit: one an admin recorded, or the cloud's usual default.
 * Apply itself stops with what to ask for if the cloud refuses a link.
 */

/** Accounts this plan creates; adopted ones (the bootstrap's control project) exist already. */
export function accountsAdded(
  zone: DesiredZone,
  recorded: ReadonlyMap<string, RecordedResource>,
): number {
  return zone.resources.filter(
    (resource: DesiredResource) =>
      resource.kind === 'account' &&
      resource.spec['adopt'] !== true &&
      statusOf(resource, recorded) === 'create',
  ).length;
}

export async function billingOf(
  provider: CloudProvider,
  connection: ConnectionRecord,
  adding: number,
): Promise<PlanBilling | null> {
  if (!provider.org?.billing) return null;
  const headroom = await provider.org.billing(connection);
  return { ...headroom, adding };
}

export function billingWarning(billing: PlanBilling | null, unit: string): string[] {
  if (!billing || billing.adding === 0) return [];
  const total = billing.linked + billing.adding;
  if (total <= billing.limit) return [];
  const limit = billing.recorded
    ? `the ${billing.limit} recorded on this connection`
    : `${billing.limit}, the usual limit for a new billing account (Google does not publish it)`;
  return [
    `Billing account ${billing.account} pays for ${billing.linked} ${unit}s and this plan adds ${billing.adding}, which is more than ${limit}. If Google refuses a link, Apply stops and says how to ask for more`,
  ];
}
