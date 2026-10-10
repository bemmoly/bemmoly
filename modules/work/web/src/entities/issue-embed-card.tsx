import {
  epicColor,
  epicFill,
  focusRing,
  IssueAssignee,
  PRIORITIES,
  PriorityGlyph,
  Skeleton,
  StatusGlyph,
  statusStage,
  Tooltip,
  TypeGlyph,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { issueHref } from '../home/my-work-row.tsx';
import { typeGlyph } from '../issue/vocabulary.ts';
import { follow, useIssueSummary } from './issue-chip.tsx';

/*
 * An issue as a block in a document (the Docs review's Linked work tab): type tile, key and
 * title on the first line with Open, then status, priority, assignee, sprint and epic, live
 * from the Issue page's cache entry. An issue the reader cannot open says so in plain words.
 */

const CARD = 'flex flex-col gap-2 rounded-dialog bg-card px-3.5 py-3 text-13 text-tx shadow-e1';
const FACT = 'inline-flex min-w-0 items-center gap-1.5';

export function IssueEmbedCard({ entityKey }: { entityKey: string }) {
  const { data: issue, isError, isPending } = useIssueSummary(entityKey);
  if (isPending) {
    return (
      <div aria-busy className={CARD}>
        <div className="flex items-center gap-2">
          <Skeleton width={16} height={16} className="rounded-chip" />
          <span className="font-mono text-12 text-tx-3">{entityKey}</span>
          <Skeleton width="50%" height={12} />
        </div>
        <Skeleton width="70%" height={12} />
      </div>
    );
  }
  if (isError || !issue) {
    return (
      <div className={`${CARD} text-tx-3`}>
        <span>
          <span className="mr-2 font-mono text-12">{entityKey}</span>
          An issue you can’t see, or one that was deleted.
        </span>
      </div>
    );
  }
  const href = issueHref(issue.key);
  const epic = issue.type.level === 'standard' ? issue.parent : null;
  return (
    <div className={CARD} data-issue-card={issue.key}>
      <div className="flex min-w-0 items-center gap-2">
        <TypeGlyph type={typeGlyph(issue.type)} size={16} />
        <span className="font-mono text-12 text-tx-3">{issue.key}</span>
        <b className="min-w-0 flex-1 truncate font-semibold" title={issue.title}>
          {issue.title}
        </b>
        <Tooltip label="Open issue">
          <a
            href={href}
            aria-label={`Open ${issue.key}`}
            onClick={(event) => follow(event, href)}
            className={`grid size-6 place-items-center rounded-control text-tx-3 hover:bg-hover hover:text-tx ${focusRing}`}
          >
            <Icon name="expand" size={14} />
          </a>
        </Tooltip>
      </div>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-13 text-tx-2">
        <span className={FACT}>
          <StatusGlyph
            stage={statusStage(issue.status.category, issue.status.name)}
            decorative
            size={13}
          />
          {issue.status.name}
        </span>
        <span className={FACT}>
          <PriorityGlyph priority={issue.priority} size={14} />
          {PRIORITIES[issue.priority]?.name ?? 'No priority'}
        </span>
        <span className={FACT}>
          <IssueAssignee person={issue.assignee} size={18} />
          {issue.assignee?.name ?? 'Unassigned'}
        </span>
        {issue.sprint && (
          <span className={FACT}>
            <Icon name="target" size={13} className="text-tx-3" />
            {issue.sprint.name}
          </span>
        )}
        {epic && (
          <span className={FACT}>
            <i
              aria-hidden
              className={`size-2 shrink-0 rounded-[2.5px] ${epicFill(epicColor(epic.color, epic.id))}`}
            />
            <span className="truncate">{epic.title}</span>
          </span>
        )}
      </div>
    </div>
  );
}
