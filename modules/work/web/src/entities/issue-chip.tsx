import { navigateInApp } from '@bemmoly/core-web';
import {
  KeyChip,
  Skeleton,
  StatusBadge,
  StatusGlyph,
  statusStage,
  TypeGlyph,
  typeLook,
  type TypeColorToken,
} from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import type { MouseEvent } from 'react';
import { issueHref } from '../home/my-work-row.tsx';
import { statusTone, typeGlyph } from '../issue/vocabulary.ts';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';

/*
 * Issues as other modules draw them: the inline chip of the Doc Editor mock
 * (type square, key, status) and the "Linked" panel row (key, title,
 * status). Both read the issue through Work's own API, sharing the Issue
 * page's cache entry, so a chip is as current as the issue and an issue the
 * reader may not open prints as its bare key.
 */

/** The type square's colour in the inline chip, by the type's colour. */
const TYPE_SQUARE: Record<TypeColorToken, string> = {
  'type-story': 'bg-type-story',
  'type-bug': 'bg-type-bug',
  'type-task': 'bg-type-task',
  'type-epic': 'bg-type-epic',
  'type-incident': 'bg-type-incident',
  'type-subtask': 'bg-type-subtask',
};

export function useIssueSummary(key: string) {
  return useQuery({
    queryKey: workKeys.issue(key),
    queryFn: () => api.work.issues.get(key),
    staleTime: 30_000,
    retry: false,
  });
}

/** In-app navigation for a plain click; modified clicks open a tab as links do. */
function follow(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateInApp(href);
}

/** The inline chip: the key alone until the issue loads, or when it cannot be opened. */
export function IssueChip({ entityKey }: { entityKey: string }) {
  const { data: issue, isError } = useIssueSummary(entityKey);
  if (!issue) {
    return (
      <span
        aria-busy={!isError}
        title={isError ? 'This issue was not found or is not shared with you' : undefined}
      >
        <KeyChip issueKey={entityKey} inline className={isError ? 'text-tx4' : undefined} />
      </span>
    );
  }
  const href = issueHref(issue.key);
  return (
    <KeyChip
      issueKey={issue.key}
      inline
      href={href}
      title={issue.title}
      typeClassName={TYPE_SQUARE[typeLook(issue.type).color]}
      onClick={(event) => follow(event, href)}
    >
      <StatusBadge
        size="xs"
        category={statusTone(issue.status.category, issue.status.name)}
        label={issue.status.name}
      />
    </KeyChip>
  );
}

const ROW =
  'flex min-w-0 items-center gap-2.5 rounded-sm border border-br2 bg-sf px-3 py-2 text-13 text-tx no-underline';

/** A "Linked" panel row: type, key, title and status, as one link to the issue. */
export function IssueCard({ entityKey }: { entityKey: string }) {
  const { data: issue, isError, isPending } = useIssueSummary(entityKey);
  if (isPending) {
    return (
      <div aria-busy className={ROW}>
        <Skeleton width={14} height={14} className="rounded-chip" />
        <KeyChip issueKey={entityKey} />
        <Skeleton width="60%" height={12} />
      </div>
    );
  }
  if (isError || !issue) {
    return (
      <div className={`${ROW} text-tx4`}>
        <KeyChip issueKey={entityKey} />
        <span className="truncate">Not found or not shared with you</span>
      </div>
    );
  }
  const href = issueHref(issue.key);
  return (
    <a
      href={href}
      onClick={(event) => follow(event, href)}
      className={`${ROW} hover:bg-sf2 focus-ring motion-safe:transition-colors`}
    >
      <TypeGlyph type={typeGlyph(issue.type)} />
      <KeyChip issueKey={issue.key} />
      <span className="min-w-0 flex-1 truncate" title={issue.title}>
        {issue.title}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-12 text-tx-2">
        <StatusGlyph
          stage={statusStage(issue.status.category, issue.status.name)}
          size={12}
          decorative
        />
        {issue.status.name}
      </span>
    </a>
  );
}
