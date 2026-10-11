import type { Project } from '@bemmoly/module-work/shared';
import { RelativeTime } from '@bemmoly/ui';
import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '../settings/cx.ts';
import { KeyCell, LeadCell, MethodCell, ProjectIdentity, StarButton } from './project-cells.tsx';
import { ProjectProgress } from './project-progress.tsx';
import type { ProjectRowActions } from './projects-table.tsx';

const STEP: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, j: 1, k: -1 };

/** Arrow keys walk the cards in reading order; Enter opens the board. */
function onCardKey(event: KeyboardEvent<HTMLElement>, open: () => void) {
  if (event.target !== event.currentTarget) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    open();
    return;
  }
  const step = STEP[event.key];
  if (!step) return;
  const cards = [
    ...(event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[data-project-card]') ??
      []),
  ];
  const next = cards[cards.indexOf(event.currentTarget) + step];
  if (!next) return;
  event.preventDefault();
  next.focus();
}

/** Projects as cards: the same identity, lead, method and progress, for scanning by colour. */
export function ProjectsGrid({
  rows,
  actions,
  empty,
}: {
  rows: readonly Project[];
  actions: ProjectRowActions;
  empty: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <ul aria-label="Projects" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((project) => {
        const team = actions.teamOf(project);
        return (
          <li
            key={project.id}
            data-project-card=""
            tabIndex={0}
            aria-label={project.name}
            onClick={() => actions.open(project)}
            onKeyDown={(event) => onCardKey(event, () => actions.open(project))}
            className={cx(
              'group/row flex cursor-pointer flex-col gap-3 rounded-card bg-card p-4 shadow-e1 transition-shadow duration-base hover:shadow-e2 focus-ring',
              project.archivedAt !== null && 'opacity-70',
            )}
          >
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <ProjectIdentity project={project} size={32} />
              </span>
              {!project.archivedAt && (
                <StarButton
                  project={project}
                  starred={actions.isStarred(project.key)}
                  onToggle={() => actions.toggleStar(project.key)}
                />
              )}
              {actions.menu(project)}
            </div>
            <ProjectProgress project={project} />
            <div className="flex items-center gap-3 text-12 text-tx-3">
              <LeadCell {...actions.leadOf(team)} />
              <span className="ml-auto flex shrink-0 items-center gap-3">
                <MethodCell method={project.method} />
                <KeyCell project={project} />
              </span>
            </div>
            <div className="text-12 text-tx-3">
              Updated <RelativeTime iso={project.updatedAt} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
