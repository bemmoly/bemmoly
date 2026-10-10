import type { BoardView, Project, Sprint } from '@bemmoly/module-work/shared';
import { Skeleton } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { linkTo, workPaths } from '../hooks/issue-navigation.ts';
import { api, useProject, workKeys } from '../shared/index.ts';
import { ProjectTile } from '../shared/project-tile.tsx';

const DAY = 86_400_000;

function endsLine(sprint: Sprint | undefined, now = Date.now()): string | null {
  if (!sprint?.endsAt) return null;
  const left = Math.ceil((Date.parse(sprint.endsAt) - now) / DAY);
  if (left < 0) return 'Overdue';
  if (left === 0) return 'Ends today';
  return left === 1 ? '1 day left' : `${left} days left`;
}

/** A ring that fills with the share of points done; the number beside it says the same. */
function Ring({ share }: { share: number }) {
  const circumference = 2 * Math.PI * 15;
  return (
    <svg width="56" height="56" viewBox="0 0 36 36" aria-hidden className="shrink-0 -rotate-90">
      <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle
        cx="18"
        cy="18"
        r="15"
        fill="none"
        stroke="var(--done)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${share * circumference} ${circumference}`}
        className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-500"
      />
    </svg>
  );
}

function useSprintGlance(project: Project | undefined) {
  const projectId = project?.id ?? '';
  const boards = useQuery({
    queryKey: workKeys.boards(projectId),
    queryFn: () => api.work.boards.list(projectId),
    enabled: Boolean(project),
  });
  const boardId = boards.data?.[0]?.id ?? '';
  const view = useQuery({
    queryKey: workKeys.boardView(boardId, {}),
    queryFn: ({ signal }) => api.work.boards.view(boardId, {}, { signal }),
    enabled: Boolean(boardId),
  });
  const sprints = useQuery({
    queryKey: workKeys.sprints(projectId),
    queryFn: async () => (await api.work.sprints.list(projectId)).items,
    enabled: project?.method === 'scrum',
  });
  const sprintId = view.data?.sprintId ?? null;
  return {
    view: view.data,
    sprint: sprints.data?.find((sprint) => sprint.id === sprintId),
    isPending: Boolean(project) && (boards.isPending || (Boolean(boardId) && view.isPending)),
  };
}

const blocked = (view: BoardView | undefined) =>
  (view?.cards ?? []).filter((card) => card.blockedBy.length > 0).length;

/**
 * Sprint at a glance, for the project the person is working in: the share of points done as a
 * ring, what is in progress, and what is blocked in the danger colour. A Kanban project shows
 * its flow instead; a project with no running sprint says where to start one.
 */
export function SprintCard() {
  const { project, isPending: projectPending } = useProject();
  const glance = useSprintGlance(project);
  if (projectPending || glance.isPending) {
    return (
      <section
        aria-busy
        aria-label="Loading the sprint"
        className="flex flex-col gap-3 rounded-card bg-card p-3.5 shadow-e1"
      >
        <Skeleton width={140} height={12} />
        <div className="flex items-center gap-4">
          <Skeleton width={56} height={56} className="rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton width={110} height={10} />
            <Skeleton width={90} height={10} />
          </div>
        </div>
      </section>
    );
  }
  if (!project) return null;
  const kanban = project.method === 'kanban';
  const metrics = glance.view?.metrics;
  const committed = metrics?.committedPoints ?? 0;
  const completed = metrics?.completedPoints ?? 0;
  const ends = endsLine(glance.sprint);
  const stuck = blocked(glance.view);
  const board = linkTo(workPaths.board(project.key));
  return (
    <section
      aria-label="Sprint at a glance"
      className="flex flex-col gap-3.5 rounded-card bg-card p-3.5 shadow-e1"
    >
      <a
        {...board}
        className="flex min-w-0 items-center gap-2 text-13 text-tx no-underline hover:text-acc"
      >
        <ProjectTile project={project} size={18} />
        <b className="truncate font-semibold">
          {kanban ? `${project.name} flow` : (glance.sprint?.name ?? project.name)}
        </b>
        {ends ? (
          <span className="ml-auto shrink-0 rounded-full bg-amber-50 px-2 text-11 leading-5 font-medium text-amber-tx">
            {ends}
          </span>
        ) : null}
      </a>
      {!kanban && !glance.sprint ? (
        <p className="m-0 text-13 text-tx-3">
          No sprint is running.{' '}
          <a {...linkTo(workPaths.backlog(project.key))}>Plan one in the backlog</a>
        </p>
      ) : (
        <div className="flex items-center gap-4">
          {kanban ? null : <Ring share={committed > 0 ? completed / committed : 0} />}
          <div className="flex flex-col gap-0.5 text-13 leading-relaxed tabular-nums">
            {kanban ? null : (
              <span>
                <b className="font-semibold">{completed}</b>{' '}
                <span className="text-tx-3">of {committed} points done</span>
              </span>
            )}
            <span>
              <b className="font-semibold">{metrics?.wipCount ?? 0}</b>{' '}
              <span className="text-tx-3">in progress</span>
            </span>
            <span className={stuck > 0 ? 'text-red-tx' : 'text-tx-3'}>
              <b className="font-semibold">{stuck}</b> blocked
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
