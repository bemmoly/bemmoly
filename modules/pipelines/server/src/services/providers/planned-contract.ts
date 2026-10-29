import type { ConnectionRecord } from './contract.ts';

/*
 * Parts designed but not yet built for any cloud, so screens say "Coming soon": time-boxed
 * console access and spend.
 */

export interface AccessPart {
  grant(
    connection: ConnectionRecord,
    input: { account: string; principal: string; role: string; until: Date },
  ): Promise<void>;
  revoke(
    connection: ConnectionRecord,
    input: { account: string; principal: string; role: string },
  ): Promise<void>;
}

export interface CostPart {
  spend(
    connection: ConnectionRecord,
    input: { account: string; from: Date; to: Date },
  ): Promise<{ amount: number; currency: string } | null>;
}
