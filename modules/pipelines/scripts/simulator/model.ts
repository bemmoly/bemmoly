/*
 * What the demo simulator knows: the catalog it reads once at start, the things it is moving
 * right now, and the actions it takes. The planner works only on these plain values, so the
 * same seed and the same clock always give the same sequence of actions.
 */

export interface SimApp {
  id: string;
  key: string;
  domainKey: string;
  groupKey: string;
  teamId: string | null;
  repositoryId: string | null;
  /** The owning team's people: authors and approvers come from here. */
  members: string[];
  tier: number;
  /** Busier applications run more often; 0 never runs. */
  weight: number;
  /** The latest release's version, bumped by every passing main run. */
  version: { major: number; minor: number; patch: number };
}

export interface SimEnv {
  id: string;
  key: string;
  class: 'dev' | 'staging' | 'prod';
}

export interface SimCatalog {
  apps: SimApp[];
  /** In promotion order: Dev, Staging, then every Prod region. */
  envs: SimEnv[];
  poolIds: string[];
  /** The person whose For you the demo shows; some changes and approvals are theirs. */
  demoId: string | null;
}

export type JobState = 'pending' | 'ready' | 'running' | 'passed' | 'failed' | 'skipped';

export interface SimJob {
  id: string;
  key: string;
  name: string;
  kind: 'build' | 'test' | 'scan' | 'publish';
  needs: string[];
  state: JobState;
  poolId: string | null;
  /** Decided when the run starts, so a run's outcome never depends on timing. */
  fails: boolean;
  dueAt: number;
}

export interface SimRun {
  id: string;
  appId: string;
  main: boolean;
  authorId: string | null;
  jobs: SimJob[];
}

export type LiveDeploymentState = 'pending' | 'deploying' | 'canary';

export interface SimDeployment {
  id: string;
  appId: string;
  envId: string;
  releaseId: string;
  version: string;
  promotionId: string | null;
  state: LiveDeploymentState;
  traffic: number;
  /** Canary traffic steps still to take; empty outside Prod. */
  steps: number[];
  /** Fails while deploying (0) or rolls back at this canary step; null lands. */
  failAt: number | null;
  dueAt: number;
}

export interface SimPromotion {
  id: string;
  appId: string;
  releaseId: string;
  version: string;
  state: 'awaiting_approval' | 'rolling_out';
  wave: number;
  /** Set when one of its deployments failed or rolled back. */
  outcome: 'failed' | 'rolled_back' | null;
  dueAt: number;
}

/** A release that landed in envs[envIndex] and may move on to the next environment. */
export interface Landed {
  appId: string;
  releaseId: string;
  version: string;
  envIndex: number;
  dueAt: number;
}

export interface SimState {
  runs: SimRun[];
  deployments: SimDeployment[];
  promotions: SimPromotion[];
  landed: Landed[];
  lastRunAt: number;
}

export interface NewRelease {
  id: string;
  appId: string;
  version: string;
  authorId: string | null;
}

export type DeploymentStep = 'deploying' | 'canary' | 'succeeded' | 'failed' | 'rolled_back';

export type Action =
  | { kind: 'idle' }
  | {
      kind: 'run.start';
      run: SimRun;
      title: string;
      sha: string;
      pullRequest: number | null;
    }
  | { kind: 'job.start'; runId: string; jobId: string; appId: string; jobName: string }
  | {
      kind: 'job.finish';
      runId: string;
      jobId: string;
      appId: string;
      jobName: string;
      passed: boolean;
      /** A passing main run makes a release, and Dev picks it up at once. */
      release: NewRelease | null;
      deployment: SimDeployment | null;
    }
  | { kind: 'deployment.start'; deployment: SimDeployment; startedBy: string | null }
  | {
      kind: 'deployment.step';
      deploymentId: string;
      appId: string;
      envId: string;
      version: string;
      state: DeploymentStep;
      traffic: number;
      message: string;
    }
  | {
      kind: 'promotion.request';
      promotion: SimPromotion;
      requestedBy: string | null;
      /** No approval needed: the rollout starts with these deployments. */
      deployments: SimDeployment[];
    }
  | {
      kind: 'promotion.approve';
      promotionId: string;
      approverId: string | null;
      deployments: SimDeployment[];
    }
  | { kind: 'promotion.wave'; promotionId: string; wave: number; deployments: SimDeployment[] }
  | {
      kind: 'promotion.finish';
      promotionId: string;
      outcome: 'succeeded' | 'failed' | 'rolled_back';
      reason: string;
    };

export interface SimLimits {
  /** Runs in progress the simulator keeps going; new ones start below it. */
  runs: number;
  /** Open promotions at once, so approvals stay a handful. */
  promotions: number;
  /** Deployments in progress at once. */
  deployments: number;
}

export const emptyState = (): SimState => ({
  runs: [],
  deployments: [],
  promotions: [],
  landed: [],
  lastRunAt: 0,
});
