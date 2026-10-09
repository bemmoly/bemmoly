import type { Issue } from '@bemmoly/module-work/shared';
import { CapacityBar, SprintContainer, SprintHeader } from '@bemmoly/ui';
import { useId, type ReactNode, type RefObject } from 'react';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import type { RowHandlers } from './backlog-item.tsx';
import { BacklogRows } from './backlog-rows.tsx';
import { InlineCreate } from './inline-create.tsx';
import { countsOf, points, sprintDates, type Container, type Lookups } from './model.ts';

export interface SprintSectionProps {
  container: Container;
  /** The rows the filters leave, in rank order. */
  visible: readonly Issue[];
  filtered: boolean;
  lookups: Lookups;
  handlers: RowHandlers;
  entryId: string | null;
  scrollRef: RefObject<HTMLElement | null>;
  onAction: () => void;
  onMore?: () => void;
  onCreateIssue: (title: string) => Promise<unknown>;
}

/** What the header says about points: done so far when active, against capacity when planned. */
function capacityOf(container: Container, lookups: Lookups): ReactNode {
  const sprint = container.sprint;
  if (!sprint) return undefined;
  const committed = points(container.issues);
  if (sprint.state === 'active') {
    const done = points(
      container.issues.filter((issue) => lookups.statuses.get(issue.statusId)?.done),
    );
    return `${committed} pts · ${done} done`;
  }
  if (sprint.capacityPoints !== null) {
    return (
      <CapacityBar
        committed={committed}
        capacity={sprint.capacityPoints}
        label={`${sprint.name} capacity`}
      />
    );
  }
  return `${committed} pts`;
}

const ACTIONS = { active: 'Complete sprint', future: 'Start sprint', closed: undefined } as const;

/**
 * A sprint or the backlog: the header with dates, goal, counts and capacity,
 * the rows, and the inline create. The header is the container's top drop
 * place; the rest of it is its end.
 */
export function SprintSection({
  container,
  visible,
  filtered,
  lookups,
  handlers,
  entryId,
  scrollRef,
  onAction,
  onMore,
  onCreateIssue,
}: SprintSectionProps) {
  const bodyId = useId();
  const open = useBacklogUi((state) => !state.collapsed[container.id]);
  const toggle = useBacklogUi((state) => state.toggleCollapsed);
  const dropAtEnd = useBacklogUi(
    (state) =>
      state.drag?.target?.containerId === container.id && state.drag.target.beforeId === null,
  );
  const sprint = container.sprint;
  const dates = sprint ? sprintDates(sprint) : undefined;

  return (
    <div data-container-id={container.id} className="mt-4">
      <SprintContainer
        id={bodyId}
        open={open}
        active={sprint?.state === 'active'}
        className={dropAtEnd && !open ? 'outline-2 -outline-offset-2 outline-ac' : undefined}
        header={
          <div data-drop-top>
            <SprintHeader
              name={sprint?.name ?? 'Backlog'}
              {...(dates ? { dates } : {})}
              {...(sprint?.goal ? { goal: sprint.goal } : {})}
              active={sprint?.state === 'active'}
              issueCount={visible.length}
              counts={countsOf(visible, lookups.statuses)}
              capacity={capacityOf(container, lookups)}
              action={sprint ? ACTIONS[sprint.state] : 'Create sprint'}
              onAction={onAction}
              {...(onMore ? { onMore } : {})}
              open={open}
              onToggle={() => toggle(container.id)}
              controls={bodyId}
            />
          </div>
        }
      >
        <div
          role="listbox"
          aria-multiselectable
          aria-label={sprint?.name ?? 'Backlog'}
          className="flex flex-col"
        >
          <BacklogRows
            containerId={container.id}
            issues={visible}
            lookups={lookups}
            handlers={handlers}
            entryId={entryId}
            scrollRef={scrollRef}
          />
        </div>
        {visible.length === 0 && (
          <div className="border-b border-br-row px-3.5 py-2.25 pl-12.5 text-12h text-tx5">
            {filtered
              ? 'No issues here match the filters.'
              : sprint
                ? 'Drag issues here to plan this sprint.'
                : 'The backlog is empty.'}
          </div>
        )}
        <div className="relative">
          {dropAtEnd && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-px z-10 h-0.5 bg-ac"
            />
          )}
          <InlineCreate containerId={container.id} onCreate={onCreateIssue} />
        </div>
      </SprintContainer>
    </div>
  );
}
