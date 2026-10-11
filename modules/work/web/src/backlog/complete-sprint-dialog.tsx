import type { Sprint } from '@bemmoly/module-work/shared';
import { Button, Field, Modal, ProgressBar, Select } from '@bemmoly/ui';
import { useState } from 'react';
import type { useSprintActions } from '../hooks/backlog-sprints.ts';
import { points, type Container, type Lookups } from './model.ts';

export interface CompleteSprintDialogProps {
  container: Container;
  /** Sprints that have not started, where unfinished work can go. */
  future: readonly Sprint[];
  /** The name a new sprint would get. */
  newSprintName: string;
  lookups: Lookups;
  actions: ReturnType<typeof useSprintActions>;
  onClose: () => void;
}

const NEW = 'new';

function Tally({ label, issues, pts }: { label: string; issues: number; pts: number }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-card border border-line bg-sunken px-3.5 py-3">
      <span className="text-12 text-tx-3">{label}</span>
      <span className="text-20 font-semibold tabular-nums">
        {issues} {issues === 1 ? 'issue' : 'issues'}
      </span>
      <span className="text-12 text-tx-3 tabular-nums">{pts} points</span>
    </div>
  );
}

/** The sprint in one line: how much of the committed work got done, by points or by count. */
function Summary({ done, total, unit }: { done: number; total: number; unit: string }) {
  const pct = total === 0 ? 0 : (done / total) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-13">
        <span className="font-medium text-tx">{Math.round(pct)}% done</span>
        <span className="text-12 text-tx-3 tabular-nums">
          {done} of {total} {unit}
        </span>
      </div>
      <ProgressBar value={pct} size="sm" label="Sprint completion" />
    </div>
  );
}

/**
 * Completing the active sprint: what was done against what was not, and
 * where the unfinished issues go: the backlog, a planned sprint, or a new
 * one created on the way. The velocity snapshot is the server's to write.
 */
export function CompleteSprintDialog({
  container,
  future,
  newSprintName,
  lookups,
  actions,
  onClose,
}: CompleteSprintDialogProps) {
  const sprint = container.sprint as Sprint;
  const done = container.issues.filter((issue) => lookups.statuses.get(issue.statusId)?.done);
  const open = container.issues.filter((issue) => !lookups.statuses.get(issue.statusId)?.done);
  const [destination, setDestination] = useState(future[0]?.id ?? 'backlog');
  const [error, setError] = useState<string | null>(null);
  const totalPts = points(container.issues);
  const busy = actions.complete.isPending || actions.create.isPending;

  const submit = async () => {
    setError(null);
    try {
      let moveUnfinishedTo = destination;
      if (open.length > 0 && destination === NEW) {
        moveUnfinishedTo = (await actions.create.mutateAsync(newSprintName)).id;
      }
      await actions.complete.mutateAsync({
        id: sprint.id,
        body: { moveUnfinishedTo: open.length > 0 ? moveUnfinishedTo : 'backlog' },
      });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The sprint was not completed.');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width="md"
      title={`Complete ${sprint.name}`}
      description="The sprint closes and its numbers go to the velocity report."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            Complete sprint
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {totalPts > 0 ? (
          <Summary done={points(done)} total={totalPts} unit="points" />
        ) : (
          <Summary done={done.length} total={container.issues.length} unit="issues" />
        )}
        <div className="flex gap-3 max-sm:flex-col">
          <Tally label="Completed" issues={done.length} pts={points(done)} />
          <Tally label="Unfinished" issues={open.length} pts={points(open)} />
        </div>
        {open.length > 0 ? (
          <Field label="Move unfinished issues to">
            <Select
              value={destination}
              onChange={(event) => setDestination(event.value)}
              options={[
                ...future.map((entry) => ({ value: entry.id, label: entry.name })),
                { value: 'backlog', label: 'Backlog' },
                { value: NEW, label: `New sprint (${newSprintName})` },
              ]}
            />
          </Field>
        ) : (
          <p className="m-0 text-13 text-tx-2">Every issue in this sprint is done.</p>
        )}
        {error && (
          <p role="alert" className="m-0 text-12 text-red-tx">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
