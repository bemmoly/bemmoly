import { navigateInApp } from '@bemmoly/core-web';
import {
  focusRing,
  IssueAssignee,
  Skeleton,
  StatusGlyph,
  statusStage,
  TypeGlyph,
} from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import type { MouseEvent } from 'react';
import { issueHref } from '../home/my-work-row.tsx';
import { typeGlyph } from '../issue/vocabulary.ts';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';

/*
 * Issues as other modules draw them, in Work's own vocabulary (the Docs review's Linked work
 * tab): the inline chip (type tile, key, title, status glyph) and the "Linked" row (the same,
 * one line). No uppercase status pills. Both read the issue through Work's own API, sharing
 * the Issue page's cache entry, so a chip is as current as the issue, and an issue the reader
 * may not open prints as its bare key.
 */

export function useIssueSummary(key: string) {
  return useQuery({
    queryKey: workKeys.issue(key),
    queryFn: () => api.work.issues.get(key),
    staleTime: 30_000,
    retry: false,
  });
}

/** In-app navigation for a plain click; modified clicks open a tab as links do. */
export function follow(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateInApp(href);
}

const CHIP =
  'inline-flex h-5.75 max-w-90 items-center gap-1.25 rounded-control bg-card pr-1.75 pl-1 align-[1px] text-13 leading-none whitespace-nowrap text-tx no-underline shadow-[inset_0_0_0_1px_var(--line)]';
const KEY = 'font-mono text-12 text-tx-3';

/** The inline chip: the key alone until the issue loads, or when it cannot be opened. */
export function IssueChip({ entityKey }: { entityKey: string }) {
  const { data: issue, isError } = useIssueSummary(entityKey);
  if (!issue) {
    return (
      <span
        aria-busy={!isError}
        className={CHIP}
        title={isError ? 'An issue you can’t see, or one that was deleted' : undefined}
      >
        <span className={isError ? `${KEY} line-through` : KEY}>{entityKey}</span>
        {isError && <span className="text-12 text-tx-3">Not available</span>}
      </span>
    );
  }
  const href = issueHref(issue.key);
  const stage = statusStage(issue.status.category, issue.status.name);
  return (
    <a
      href={href}
      title={`${issue.key} · ${issue.title} · ${issue.status.name}`}
      onClick={(event) => follow(event, href)}
      className={`${CHIP} hover:bg-hover ${focusRing}`}
    >
      <TypeGlyph type={typeGlyph(issue.type)} size={14} />
      <span className={KEY}>{issue.key}</span>
      <span className="min-w-0 truncate">{issue.title}</span>
      <StatusGlyph stage={stage} label={issue.status.name} size={13} />
    </a>
  );
}

const ROW = 'flex h-9 min-w-0 items-center gap-2 rounded-card px-2 text-13 text-tx no-underline';

/** A "Linked" row: type tile, key, title, status glyph and assignee, as one link to the issue. */
export function IssueCard({ entityKey }: { entityKey: string }) {
  const { data: issue, isError, isPending } = useIssueSummary(entityKey);
  if (isPending) {
    return (
      <div aria-busy className={ROW}>
        <Skeleton width={15} height={15} className="rounded-chip" />
        <span className={KEY}>{entityKey}</span>
        <Skeleton width="60%" height={12} />
      </div>
    );
  }
  if (isError || !issue) {
    return (
      <div className={`${ROW} text-tx-3`}>
        <span className={KEY}>{entityKey}</span>
        <span className="truncate">An issue you can’t see, or one that was deleted</span>
      </div>
    );
  }
  const href = issueHref(issue.key);
  return (
    <a
      href={href}
      onClick={(event) => follow(event, href)}
      className={`${ROW} hover:bg-hover ${focusRing} motion-safe:transition-colors`}
    >
      <TypeGlyph type={typeGlyph(issue.type)} size={15} />
      <span className={KEY}>{issue.key}</span>
      <span className="min-w-0 flex-1 truncate" title={issue.title}>
        {issue.title}
      </span>
      <StatusGlyph
        stage={statusStage(issue.status.category, issue.status.name)}
        label={issue.status.name}
        size={13}
      />
      <IssueAssignee person={issue.assignee} size={18} />
    </a>
  );
}
