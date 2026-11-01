import type { SecretsAs } from '../../../../shared/deploy-settings.ts';

/*
 * What a deploy is told about how the revision runs, resolved for its environment and runtime
 * before the provider sees it (services/deploy-settings): every field filled in, null where
 * nothing set it and the runtime keeps its own default. And the addresses a deploy answers
 * with, which other applications' variables are filled in from.
 */

export interface ResolvedDeploySettings {
  scaling: {
    /** Instances on Cloud Run, replicas on GKE. */
    min: number;
    max: number | null;
    /** Cloud Run only. */
    concurrency: number | null;
    /** GKE only: percent of requested CPU the autoscaler aims for. */
    cpuTarget: number | null;
  };
  resources: { cpu: string | null; memory: string | null };
  port: number | null;
  healthcheck: { path: string | null; ready: string | null; timeoutSeconds: number };
  secretsAs: SecretsAs;
  /** Pods that may be down at once while a cluster upgrades; null for no budget. */
  maxUnavailable: number | null;
  public: boolean;
}

/** Where a deployed application answers in its environment. */
export interface ServiceAddress {
  /** What services in the same environment call: run.app, or the in-cluster name on GKE. */
  url: string | null;
  /** What the internet calls; null until there is one. */
  publicUrl: string | null;
}
