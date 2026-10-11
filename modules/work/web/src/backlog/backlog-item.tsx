import type { Issue } from '@bemmoly/module-work/shared';
import { IssueRow, statusStage } from '@bemmoly/ui';
import {
  memo,
  startTransition,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import { useIssuePending } from '../hooks/issue-edits.ts';
import { useSearchParamIs } from '../shared/url-state.ts';
import { openRowMenu, ROW_MENU } from '../shared/issue-actions-menu.tsx';
import { useBacklogRowShared } from './backlog-row-context.ts';
import type { Lookups, StatusLook } from './model.ts';

export interface RowHandlers {
  onClick(event: MouseEvent<HTMLElement>, id: string): void;
  onPointerDown(event: PointerEvent<HTMLElement>, id: string): void;
  onKeyDown(event: KeyboardEvent<HTMLElement>, id: string): void;
  onOpen(id: string): void;
  /** The selection box: Shift extends from the anchor, otherwise it toggles one row. */
  onCheck(event: MouseEvent<HTMLElement>, id: string): void;
}

export interface BacklogItemProps {
  issue: Issue;
  containerId: string;
  lookups: Lookups;
  handlers: RowHandlers;
  /** The one row Tab reaches; arrows move between the rest. */
  entry: boolean;
  /** Set by the virtual list so it can measure the row. */
  index?: number;
}

const FOCUS = 'focus-ring-inset';

/** The row's status glyph: its column's place for the stage, its own name for the label. */
const stageOf = (look: StatusLook | undefined) =>
  look
    ? statusStage(
        look.done ? 'done' : look.category === 'todo' ? 'todo' : 'in_progress',
        look.category === 'review' ? 'review' : look.category === 'qa' ? 'qa' : look.label,
      )
    : 'todo';

/**
 * One issue in a container: the design system's row inside an option that
 * carries selection, focus, the drag handlers and the drop line. Each row
 * reads only its own slice of the drag and selection state, and draws its
 * menu only once someone reaches it.
 */
export const BacklogItem = memo(function BacklogItem({
  issue,
  containerId,
  lookups,
  handlers,
  entry,
  index,
}: BacklogItemProps) {
  const id = issue.id;
  const selected = useBacklogUi((state) => state.selection.ids.includes(id));
  const selecting = useBacklogUi((state) => state.selection.ids.length > 0);
  const open = useSearchParamIs('issue', issue.key);
  const { blocked, menu, touch } = useBacklogRowShared();
  // The menu is drawn the first time the pointer or the focus reaches the row.
  const [reached, setReached] = useState(false);
  const reach = reached ? undefined : () => startTransition(() => setReached(true));
  const dragged = useBacklogUi((state) => state.drag?.ids.includes(id) ?? false);
  const pending = useIssuePending(issue.key);
  const dropAbove = useBacklogUi(
    (state) => state.drag?.target?.containerId === containerId && state.drag.target.beforeId === id,
  );
  const status = lookups.statuses.get(issue.statusId);
  const epic = issue.parentId ? lookups.epics.get(issue.parentId) : undefined;
  const person = issue.assigneeId ? lookups.people.get(issue.assigneeId) : undefined;

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={entry ? 0 : -1}
      data-row-id={id}
      data-issue-key={issue.key}
      data-container-id={containerId}
      data-index={index}
      onClick={(event) => handlers.onClick(event, id)}
      onPointerEnter={reach}
      onFocus={reach}
      onContextMenu={(event) => {
        if (!event.currentTarget.querySelector(`[${ROW_MENU}]`)) flushSync(() => setReached(true));
        openRowMenu(event);
      }}
      onPointerDown={(event) => handlers.onPointerDown(event, id)}
      onKeyDown={(event) => handlers.onKeyDown(event, id)}
      className={`group/item relative cursor-pointer select-none ${FOCUS} ${dragged ? 'opacity-50' : ''}`}
    >
      {dropAbove && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-px z-10 h-0.5 bg-acc"
        />
      )}
      <IssueRow
        issueKey={issue.key}
        title={issue.title}
        type={lookups.types.get(issue.typeId) ?? 'task'}
        priority={issue.priority}
        status={{ stage: stageOf(status), ...(status ? { label: status.label } : {}) }}
        {...(epic ? { epic: { name: epic.title, color: epic.look } } : {})}
        assignee={person ? { name: person.name, initials: person.initials, hue: person.hue } : null}
        {...(issue.estimate !== null ? { estimate: issue.estimate } : {})}
        {...(blocked[id]?.[0] ? { blockedBy: blocked[id][0] } : {})}
        selected={open}
        checked={selected}
        pending={pending}
        selecting={selecting}
        onCheck={(event) => handlers.onCheck(event, id)}
      />
      <span
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        className="absolute top-1/2 right-0.5 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100 has-[[aria-expanded=true]]:opacity-100 pointer-coarse:opacity-100"
      >
        {(reached || touch) && menu(issue, containerId)}
      </span>
    </div>
  );
});
