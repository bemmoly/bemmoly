import type { Project } from '@bemmoly/module-work/shared';
import type { Team } from '@bemmoly/shared';
import { Avatar, avatarHue, EntityTile, IconButton, rowReveal } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { cx } from '../settings/cx.ts';

/** The star at the start of a row: amber when set, revealed on hover when not. */
export function StarButton({
  project,
  starred,
  onToggle,
}: {
  project: Project;
  starred: boolean;
  onToggle: () => void;
}) {
  return (
    <IconButton
      size="xs"
      label={starred ? `Remove star from ${project.name}` : `Star ${project.name}`}
      aria-pressed={starred}
      icon={
        <Icon name="star" size={15} className={starred ? 'fill-amber text-amber' : 'text-tx-3'} />
      }
      className={starred ? undefined : rowReveal}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    />
  );
}

/** The project's tile in its own colour (its team's, else a stable palette hue), name and description. */
export function ProjectIdentity({
  project,
  team,
  size = 28,
}: {
  project: Project;
  team: Team | undefined;
  size?: number;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <EntityTile name={project.name} color={team?.color} size={size} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-tx" title={project.name}>
          {project.name}
        </span>
        {project.description && (
          <span className="truncate text-12 text-tx-3" title={project.description}>
            {project.description}
          </span>
        )}
      </span>
    </span>
  );
}

/** The team's lead, who leads the project; "No lead" without a team. */
export function LeadCell({ id, name }: { id: string | null; name: string | null }) {
  if (!id || !name) return <span className="text-tx-3">No lead</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={name} hue={avatarHue(id)} size={20} />
      <span className="truncate text-tx-2">{name}</span>
    </span>
  );
}

export function TeamCell({ team }: { team: Team | undefined }) {
  if (!team) return <span className="text-tx-3">No team</span>;
  return (
    <span className="inline-flex h-5.5 max-w-full items-center gap-1.5 rounded-full border border-line px-2 text-12 text-tx-2">
      <Icon name="people" size={12} className="shrink-0 text-tx-3" />
      <span className="truncate">{team.name}</span>
    </span>
  );
}

export function MethodCell({ method }: { method: Project['method'] }) {
  return (
    <span className="flex items-center gap-1.5 text-tx-2">
      <Icon name={method === 'scrum' ? 'target' : 'board'} size={14} className="text-tx-3" />
      {method === 'scrum' ? 'Scrum' : 'Kanban'}
    </span>
  );
}

export function KeyCell({ project, className }: { project: Project; className?: string }) {
  return <span className={cx('font-mono text-12 text-tx-3', className)}>{project.key}</span>;
}
