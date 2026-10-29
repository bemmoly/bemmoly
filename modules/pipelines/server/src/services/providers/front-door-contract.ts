import type { DeployRuntime } from '../../../../shared/common.ts';
import type { ConnectionRecord, DeployTarget } from './contract.ts';

/*
 * The provider model's front door (contract.ts): one stable address per environment, and a
 * host per application on it whose traffic is split by weight between the runtimes it runs
 * on. Moving an application between runtimes is then a canary between two backends, and
 * going back is putting the weight back. One load balancer per environment rather than per
 * application: its forwarding rule is billed by the hour and counted against a small
 * per-project quota, and a host rule per application costs neither.
 */

export interface FrontDoorSpec {
  /** "prod-asia-south1": every resource the front door makes is named after it. */
  environment: string;
  /** The account (project) it lives in, and who deploys there. */
  account: { externalId: string; config?: Readonly<Record<string, unknown>> };
  region: string | null;
  /** Hosts answer over HTTPS on a certificate for <application>.<domain>; null serves HTTP. */
  domain: string | null;
}

/** One share of a host's traffic: the application on one runtime. */
export interface FrontDoorBackend {
  target: DeployTarget;
  /**
   * One revision, on runtimes the front door reaches revision by revision; null sends the
   * share to the runtime's own split between its revisions.
   */
  revision: string | null;
  percent: number;
}

export interface FrontDoorState {
  /** The address to point DNS at; null until the cloud has reserved one. */
  address: string | null;
  /** What stops a host answering yet, each one sentence saying what to do; empty when none. */
  problems: string[];
}

export interface FrontDoorPart {
  /** Runtimes whose backends name one revision each, so their canaries move here too. */
  routesRevisions: readonly DeployRuntime[];
  /** Sentences a move plan shows: what has not been proved against the real cloud. */
  untested: readonly string[];
  /** Reserves the address; with a domain, reports certificates still being issued. */
  ensure(
    connection: ConnectionRecord,
    door: FrontDoorSpec,
    hosts: readonly string[],
  ): Promise<FrontDoorState>;
  /**
   * Sends one host's traffic to these backends, weights summing to 100, making what they
   * need. A backend the cloud is still making is a ProviderError a later attempt clears.
   */
  route(
    connection: ConnectionRecord,
    door: FrontDoorSpec,
    input: { application: string; host: string; backends: readonly FrontDoorBackend[] },
  ): Promise<void>;
  /** Removes the application from a runtime it moved off, once no host sends it traffic. */
  leave(target: DeployTarget): Promise<void>;
  /** Takes the front door down: the hosts stop answering and the address is released. */
  remove(
    connection: ConnectionRecord,
    door: FrontDoorSpec,
    hosts: readonly string[],
  ): Promise<void>;
}
