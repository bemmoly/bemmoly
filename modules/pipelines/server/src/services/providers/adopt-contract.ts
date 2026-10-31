import type { FlatDeploySettings } from '../../../../shared/deploy-settings.ts';
import type { ConnectionRecord, DeployTarget } from './contract.ts';

/*
 * Services that already run on the provider's default runtime (Cloud Run on Google Cloud),
 * deployed by hand or by other CI, read so Pipelines can adopt them. Reading never changes
 * them and never reads a secret's value: a secret is named by where it lives and its version.
 * And who a target's revisions run as, so a secret copied into its project can be granted.
 */

/** Where to look: one project (account) and region. */
export interface ServicePlace {
  /** The project's id in the cloud. */
  account: string;
  region: string;
  /** The account's own config in Pipelines: who to act as there. */
  accountConfig?: Readonly<Record<string, unknown>>;
}

/** One environment variable a running service has, in neutral words. */
export type RunningVariable =
  | { name: string; kind: 'plain'; value: string }
  | {
      name: string;
      kind: 'secret';
      /** The project the secret lives in, by id; its number when the service names it so. */
      account: string;
      secret: string;
      /** Always a number: "latest" is pinned to the version it is now. */
      version: string;
    };

export interface RunningService {
  name: string;
  /** Every address it answers on; the first is the one to record. */
  urls: string[];
  /** The revision taking its traffic now. */
  revision: string | null;
  /** The image by digest, split: "region-docker.pkg.dev/p/apps/cart-api" and "sha256:…". */
  image: { repository: string; digest: string } | null;
  variables: RunningVariable[];
  /** What it runs with, as deploy settings: only what the service sets. */
  settings: FlatDeploySettings;
}

export interface AdoptPart {
  listServices(connection: ConnectionRecord, place: ServicePlace): Promise<RunningService[]>;
  /** One service by name; null when there is none. */
  readService(
    connection: ConnectionRecord,
    place: ServicePlace,
    name: string,
  ): Promise<RunningService | null>;
  /** Who the target's revisions run as: whom a secret copied there must be readable by. */
  runtimePrincipal(target: DeployTarget): Promise<string>;
}
