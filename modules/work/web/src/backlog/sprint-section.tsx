import type { Issue } from '@bemmoly/module-work/shared';
import { CapacityBar, SprintContainer, SprintHeader, type SprintPoints } from '@bemmoly/ui';
import { useId, type ReactNode, type RefObject } from 'react';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import type { RowHandlers } from './backlog-item.tsx';
import { BacklogRows } from './backlog-rows.tsx';
import { ContainerEmpty } from './container-empty.tsx';
import { InlineCreate } from './inline-create.tsx';
import { points, sprintDates, type Container, type Lookups } from './model.ts';

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

/** Done, in-progress and total points of the active sprint: the two-tone bar. */
function pointsOf(container: Container, lookups: Lookups): SprintPoints | undefined {
  if (container.sprint?.state !== 'active') return undefined;
  const of = (category: 'done' | 'doing') =>
    points(
      container.issues.filter((issue) => {
        const look = lookups.statuses.get(issue.statusId);
        if (!look) return false;
        return category === 'done' ? look.done : !look.done && look.category !== 'todo';
      }),
    );
  return { done: of('done'), doing: of('doing'), total: points(container.issues) };
}

/** A planned sprint's points against its capacity, or just its points. */
function capacityOf(container: Container): ReactNode {
  const sprint = container.sprint;
  if (!sprint || sprint.state === 'active') return undefined;
  const committed = points(container.issues);
  if (sprint.capacityPoints !== null) {
    return (
      <CapacityBar
        committed={committed}
        capacity={sprint.capacityPoints}
        label={`${sprint.name} capacity`}
      />
    );
  }
  return committed > 0 ? `${committed} pts` : undefined;
}

const ACTIONS = { active: 'Complete', future: 'Start sprint', closed: undefined } as const;

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
  const sprintPoints = pointsOf(container, lookups);
  const capacity = capacityOf(container);

  return (
    <div data-container-id={container.id}>
      <SprintContainer
        id={bodyId}
        open={open}
        className={dropAtEnd && !open ? 'outline-2 -outline-offset-2 outline-acc' : undefined}
        header={
          <div data-drop-top>
            <SprintHeader
              name={sprint?.name ?? 'Backlog'}
              {...(dates ? { dates } : {})}
              {...(sprint?.goal ? { goal: sprint.goal } : {})}
              kind={sprint ? (sprint.state === 'active' ? 'active' : 'future') : 'backlog'}
              issueCount={visible.length}
              {...(sprintPoints ? { points: sprintPoints } : {})}
              {...(capacity ? { capacity } : {})}
              action={sprint ? ACTIONS[sprint.state] : undefined}
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
          <ContainerEmpty filtered={filtered} sprint={sprint !== null} containerId={container.id} />
        )}
        <div className="relative">
          {dropAtEnd && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-px z-10 h-0.5 bg-acc"
            />
          )}
          <InlineCreate containerId={container.id} onCreate={onCreateIssue} />
        </div>
      </SprintContainer>
    </div>
  );
}
