import type {
  CodeCheckState,
  CodeHostKind,
  CodeLinkKind,
  CodeLinkState,
  CodeReviewState,
} from '@bemmoly/shared';

/**
 * One pull request, branch or commit, as a code host reported it, in host-neutral words.
 * Vendor payloads never leave the host's file; modules see only this.
 */
export interface CodeActivity {
  integrationId: string;
  hostKind: CodeHostKind;
  /** owner/repository, or group/project. */
  repository: string;
  kind: CodeLinkKind;
  /** Stable within the repository: a request's number, a branch's name, a commit's sha. */
  externalId: string;
  /** How the issue page names it: "#4821", the branch name, a short sha. */
  ref: string;
  title: string;
  url: string;
  state: CodeLinkState | null;
  checks: CodeCheckState | null;
  review: CodeReviewState | null;
  author: string | null;
  /** Where issue keys are looked for: branch name, title, body, commit messages. */
  texts: readonly string[];
  /** When the host last changed it; an older report never overwrites a newer one. */
  occurredAt: string;
  /**
   * `update` changes links that already exist (checks, a review) without looking for keys,
   * because the host's report names the request but not its text. `remove` drops them
   * (a deleted branch).
   */
  mode: 'link' | 'update' | 'remove';
  /** On a push's branch activity: what the push changed. */
  push?: CodePush;
}

/** A push to a branch, as a delivery or a pipeline trigger needs it. */
export interface CodePush {
  branch: string;
  /** The commit before the push; all zeros when the branch was created. */
  before: string;
  /** The commit the branch points at now. */
  after: string;
  /** The repository's default branch, as the host reported it with the push. */
  defaultBranch: string | null;
  isDefaultBranch: boolean;
  created: boolean;
  deleted: boolean;
  forced: boolean;
  /** Files added, changed or removed by the pushed commits, deduplicated, sorted. */
  changedFiles: readonly string[];
  /** True when the host sent fewer commits than were pushed, so the files are incomplete. */
  truncated: boolean;
  commits: number;
  pusher: string | null;
}

/**
 * What happened on the host, in host-neutral words, for modules that act on events rather
 * than link them (Pipelines starts runs, reads checks and syncs files). Unlike activities,
 * events never create links, so a consumer of links never sees them.
 */
export type CodeEvent =
  | { type: 'push'; repository: string; push: CodePush; occurredAt: string }
  | {
      type: 'pull_request';
      repository: string;
      /** opened, synchronize, reopened, closed, ready_for_review, … */
      action: string;
      number: number;
      title: string;
      url: string;
      headSha: string;
      headRef: string;
      baseRef: string;
      /** From a fork: such runs get no secrets and wait for a maintainer. */
      fromFork: boolean;
      draft: boolean;
      merged: boolean;
      author: string | null;
      occurredAt: string;
    }
  | {
      type: 'merge_group';
      repository: string;
      action: string;
      headSha: string;
      headRef: string;
      baseRef: string;
      occurredAt: string;
    }
  | {
      type: 'check_run';
      repository: string;
      name: string;
      headSha: string;
      status: 'queued' | 'in_progress' | 'completed';
      conclusion: string | null;
      url: string | null;
      /** Which app reported it, so a module can ignore its own checks. */
      app: string | null;
      occurredAt: string;
    }
  | {
      type: 'workflow_run';
      repository: string;
      runId: string;
      name: string;
      /** ".github/workflows/security.yml" */
      path: string;
      headSha: string;
      headBranch: string | null;
      event: string;
      status: 'queued' | 'in_progress' | 'completed';
      conclusion: string | null;
      url: string | null;
      occurredAt: string;
    }
  | {
      type: 'repository';
      repository: string;
      /** created, renamed, archived, unarchived, transferred, deleted, added, removed */
      action: string;
      previousName: string | null;
      defaultBranch: string | null;
      occurredAt: string;
    };

/** An event with the delivery it came in, as consumers receive it. */
export type CodeEventOf = CodeEvent & {
  integrationId: string;
  hostKind: CodeHostKind;
  deliveryId: string;
};

/** A check on a commit, reported by a module (one per job state change, never per line). */
export interface CodeCheckReport {
  repository: string;
  headSha: string;
  name: string;
  /** Updates the check this id names instead of creating another. */
  externalId?: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
  detailsUrl?: string;
  title?: string;
  summary?: string;
}

export interface CodeDeploymentReport {
  repository: string;
  ref: string;
  environment: string;
  /** Updates this deployment's status instead of creating a deployment. */
  externalId?: string;
  state: 'queued' | 'in_progress' | 'success' | 'failure' | 'error' | 'inactive';
  description?: string;
  url?: string;
  production?: boolean;
}

export interface CodePullRequestInput {
  repository: string;
  baseBranch: string;
  branch: string;
  title: string;
  body: string;
  files: ReadonlyArray<{ path: string; content: string }>;
}

/**
 * The write and read calls a module may make on a repository, through the integration that
 * covers it. Every call has the host's timeout; a host that cannot do one throws a
 * ProviderError that says so.
 */
export interface CodeHostClient {
  integrationId: string;
  hostKind: CodeHostKind;
  reportCheck(report: CodeCheckReport): Promise<{ externalId: string }>;
  reportDeployment(report: CodeDeploymentReport): Promise<{ externalId: string }>;
  /** A file's text at a ref; null when it does not exist. */
  readFile(repository: string, path: string, ref: string): Promise<string | null>;
  /** Every file path at a ref (blobs only), and whether the host cut the list short. */
  listFiles(repository: string, ref: string): Promise<{ paths: string[]; truncated: boolean }>;
  openPullRequest(input: CodePullRequestInput): Promise<{ url: string; number: number }>;
}

/** A repository a connected host lets Bemmoly read, archived ones left out. */
export interface CodeHostRepository {
  fullName: string;
  hostKind: CodeHostKind;
  /** null when the host was not asked: a repository named by hand on a token connection. */
  defaultBranch: string | null;
  url: string | null;
}
