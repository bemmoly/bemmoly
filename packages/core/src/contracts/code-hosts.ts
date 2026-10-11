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
}
