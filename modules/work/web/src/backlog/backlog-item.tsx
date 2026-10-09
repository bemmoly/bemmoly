import type { Issue } from '@bemmoly/module-work/shared';
import { BacklogRow } from '@bemmoly/ui';
import { memo, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import type { Lookups } from './model.ts';

export interface RowHandlers {
  onClick(event: MouseEvent<HTMLElement>, id: string): void;
  onPointerDown(event: PointerEvent<HTMLElement>, id: string): void;
  onKeyDown(event: KeyboardEvent<HTMLElement>, id: string): void;
  onOpen(id: string): void;
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

const FOCUS = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ac';

/**
 * One issue in a container: the design system's row inside an option that
 * carries selection, focus, the drag handlers and the drop line. Each row
 * reads only its own slice of the drag and selection state.
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
  const dragged = useBacklogUi((state) => state.drag?.ids.includes(id) ?? false);
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
      data-container-id={containerId}
      data-index={index}
      onClick={(event) => handlers.onClick(event, id)}
      onDoubleClick={() => handlers.onOpen(id)}
      onPointerDown={(event) => handlers.onPointerDown(event, id)}
      onKeyDown={(event) => handlers.onKeyDown(event, id)}
      className={`relative cursor-pointer select-none ${FOCUS} ${dragged ? 'opacity-50' : ''}`}
    >
      {dropAbove && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-px z-10 h-0.5 bg-ac"
        />
      )}
      <BacklogRow
        issueKey={issue.key}
        title={issue.title}
        type={lookups.types.get(issue.typeId) ?? 'task'}
        priority={issue.priority}
        status={{ category: status?.category ?? 'todo', label: status?.label }}
        {...(epic ? { epic: { name: epic.title, colorClassName: epic.colorClassName } } : {})}
        {...(person
          ? { assignee: { name: person.name, initials: person.initials, hue: person.hue } }
          : {})}
        {...(issue.estimate !== null ? { estimate: issue.estimate } : {})}
        selected={selected}
        className={selected ? undefined : 'hover:bg-bg2'}
      />
    </div>
  );
});
