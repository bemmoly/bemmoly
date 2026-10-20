import type { Initiative, RoadmapView } from '@bemmoly/module-work/shared';
import { Button, IconButton, MetricTile, ProgressBar } from '@bemmoly/ui';
import { useState } from 'react';
import { percentDone } from '../hooks/initiatives.ts';
import type { ProgramSummary } from '../hooks/program-summary.ts';
import { longDate } from './initiatives-table.tsx';

export interface ProgramHeaderProps {
  initiative: Initiative;
  view: RoadmapView;
  summary: ProgramSummary;
  onUnlink: (epicId: string) => void;
  onUnarchive: () => void;
  onOpenIssue: (key: string) => void;
}

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`;

/**
 * Above a program's timeline: what it is for and when, the rollup tiles (epics, issues, at
 * risk, date conflicts), and the list of its epics, folded until asked for, where people who
 * manage it unlink one.
 */
export function ProgramHeader({
  initiative,
  view,
  summary,
  onUnlink,
  onUnarchive,
  onOpenIssue,
}: ProgramHeaderProps) {
  const [open, setOpen] = useState(false);
  const archived = initiative.archivedAt !== null;
  const project = new Map(view.projects.map((entry) => [entry.id, entry.name]));
  const epics = view.items.filter((item) => item.kind === 'epic');
  const percent = percentDone(initiative);
  return (
    <section
      aria-label="Program summary"
      className="flex flex-col gap-2.5 border-b border-line bg-canvas px-4 py-3"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="m-0 text-15 font-semibold text-tx">{initiative.name}</h1>
        <span className="text-12 text-tx-3 tabular-nums">
          {initiative.startAt ? `${longDate(initiative.startAt)} to ` : 'Target '}
          {longDate(initiative.targetAt)}
        </span>
        {initiative.epics.hidden > 0 && (
          <span className="text-12 text-tx-3">
            {plural(initiative.epics.hidden, 'epic')} in projects you cannot open left out
          </span>
        )}
      </div>
      {initiative.description && (
        <p className="m-0 max-w-prose text-13 text-tx-2">{initiative.description}</p>
      )}
      {archived && (
        <p className="m-0 flex items-center gap-2 text-12 text-tx-3">
          This initiative is archived; its epics stay, and none can be linked.
          {initiative.canManage && (
            <Button size="sm" onClick={onUnarchive}>
              Unarchive
            </Button>
          )}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <MetricTile label="Epics done" value={`${summary.done}/${summary.epics}`} />
        <MetricTile label="Issues done" value={`${percent}%`} childrenFirst>
          <ProgressBar
            value={percent}
            size="xs"
            fillClassName="bg-done"
            className="w-16"
            label="Issues done"
          />
        </MetricTile>
        <MetricTile
          label="At risk or late"
          value={summary.atRisk.length}
          valueTone={summary.atRisk.length > 0 ? 'warn' : 'default'}
        />
        <MetricTile
          label="Date conflicts"
          value={summary.conflicts}
          valueTone={summary.conflicts > 0 ? 'warn' : 'default'}
        />
        <MetricTile label="Across projects" value={summary.acrossTeams} />
        <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Hide epics' : `Show epics (${epics.length})`}
        </Button>
      </div>
      {open && (
        <ul aria-label="Epics in this initiative" className="m-0 flex list-none flex-col p-0">
          {epics.map((epic) => (
            <li key={epic.id} className="flex items-center gap-3 border-t border-line py-1.5">
              <button
                type="button"
                onClick={() => epic.key && onOpenIssue(epic.key)}
                className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 border-0 bg-transparent p-0 text-left font-sans text-13 text-tx focus-ring"
              >
                <span className="font-mono text-12 text-tx-3">{epic.key}</span>
                <span className="truncate">{epic.title}</span>
              </button>
              <span className="text-12 text-tx-3 max-md:hidden">{project.get(epic.projectId)}</span>
              <span className="w-24 text-right text-12 text-tx-3 tabular-nums">
                {epic.progress.done} of {epic.progress.total} done
              </span>
              {initiative.canManage && !archived && (
                <IconButton
                  icon="close"
                  size="xs"
                  label={`Unlink ${epic.key ?? epic.title}`}
                  onClick={() => onUnlink(epic.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
