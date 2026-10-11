import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';

export type CodeLinkKind = 'pull_request' | 'branch' | 'commit';
export type CodeLinkState = 'open' | 'draft' | 'merged' | 'closed';
export type CodeChecks = 'pending' | 'passing' | 'failing';
export type CodeReview = 'review_required' | 'approved' | 'changes_requested';

/** A request's state in words; the icon's colour follows the status categories. */
export const CODE_STATE_LABELS: Record<CodeLinkState, string> = {
  open: 'Open',
  draft: 'Draft',
  merged: 'Merged',
  closed: 'Closed',
};

const STATE_MARKS: Record<CodeLinkState, { icon: IconName; tone: string }> = {
  open: { icon: 'pull-request', tone: 'text-prog' },
  draft: { icon: 'pull-request-draft', tone: 'text-tx-3' },
  merged: { icon: 'merged', tone: 'text-done' },
  closed: { icon: 'pull-request-closed', tone: 'text-tx-3' },
};

const CHECKS: Record<CodeChecks, { icon: IconName; tone: string; label: string }> = {
  passing: { icon: 'check', tone: 'text-green', label: 'Checks passing' },
  failing: { icon: 'close', tone: 'text-red', label: 'Checks failing' },
  pending: { icon: 'clock', tone: 'text-amber', label: 'Checks running' },
};

export const CODE_REVIEW_LABELS: Record<CodeReview, string> = {
  review_required: 'Review requested',
  approved: 'Approved',
  changes_requested: 'Changes requested',
};

export interface CodeLinkRowProps {
  kind: CodeLinkKind;
  /** "#4821", "!57", a branch name or a short sha, in mono. */
  codeRef: string;
  /** The request's title or the commit's first line; a branch shows its name only. */
  title?: ReactNode;
  /** owner/repository, shown quietly from 640px. */
  repository?: string;
  href: string;
  /** The host's name, for the link's accessible name ("on GitHub"). */
  host: string;
  state?: CodeLinkState | null;
  checks?: CodeChecks | null;
  review?: CodeReview | null;
  className?: string;
}

function leadingMark(kind: CodeLinkKind, state: CodeLinkState | null | undefined) {
  if (kind === 'branch') return { icon: 'branch' as const, tone: 'text-tx-3' };
  if (kind === 'commit') return { icon: 'commit' as const, tone: 'text-tx-3' };
  return STATE_MARKS[state ?? 'open'];
}

/**
 * A pull request, branch or commit in an issue's Development section: a 36px list row with
 * the state icon, the mono reference, the title, then checks, review and the state's name.
 * Colour is never the only signal: every mark has words beside it or as its name. The row
 * opens the host in a new tab.
 */
export function CodeLinkRow({
  kind,
  codeRef,
  title,
  repository,
  href,
  host,
  state,
  checks,
  review,
  className,
}: CodeLinkRowProps) {
  const mark = leadingMark(kind, state);
  const branch = kind === 'branch';
  const check = checks ? CHECKS[checks] : null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cx(
        'group/row flex min-h-9 items-center gap-2.5 border-b border-line-2 px-3 text-13 text-tx no-underline hover:bg-hover',
        focusRingInset,
        className,
      )}
    >
      <span className={cx('flex shrink-0', mark.tone)}>
        <Icon name={mark.icon} size={16} />
      </span>
      <span
        className={cx(
          'shrink-0 font-mono text-12 font-medium',
          branch ? 'min-w-0 truncate text-tx' : 'text-tx-3',
        )}
      >
        {codeRef}
      </span>{' '}
      {!branch && title ? <span className="min-w-0 flex-1 truncate">{title}</span> : null}{' '}
      {branch && <span className="flex-1" />}
      {repository && (
        <span className="max-w-40 shrink-0 truncate text-12 text-tx-3 max-sm:sr-only">
          {repository}
        </span>
      )}{' '}
      {check && (
        <span className={cx('flex shrink-0', check.tone)}>
          <Icon name={check.icon} size={14} label={check.label} />
        </span>
      )}{' '}
      {review && (
        <span className="shrink-0 text-12 text-tx-2 max-sm:sr-only">
          {CODE_REVIEW_LABELS[review]}
        </span>
      )}{' '}
      {kind === 'pull_request' && state && (
        <span className="shrink-0 text-12 text-tx-2">{CODE_STATE_LABELS[state]}</span>
      )}{' '}
      {/* Spaces between the parts keep the link's spoken name readable; flex drops them. */}
      <span className="sr-only">(opens on {host})</span>
    </a>
  );
}
