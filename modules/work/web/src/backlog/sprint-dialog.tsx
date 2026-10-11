import type { Sprint } from '@bemmoly/module-work/shared';
import { Button, Field, FormGrid, FormGridItem, Input, Modal, Textarea } from '@bemmoly/ui';
import { useState, type FormEvent } from 'react';
import type { useSprintActions } from '../hooks/backlog-sprints.ts';
import { datesProblem, endOf, plannedDays, startOf } from './sprint-dates.ts';

export interface SprintDialogProps {
  /** start: name, dates and goal, then the sprint starts. edit: the same plus capacity. */
  mode: 'start' | 'edit';
  sprint: Sprint;
  cadenceDays: number;
  issueCount: number;
  committedPoints: number;
  actions: ReturnType<typeof useSprintActions>;
  onClose: () => void;
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Try again.';

/**
 * Starting or editing a sprint. Starting asks for the dates (planned ones,
 * or today plus the board's cadence) and the goal; editing adds capacity
 * and, before the sprint starts, deleting it, which returns its issues to
 * the backlog. The server's refusal is shown in place.
 */
export function SprintDialog({
  mode,
  sprint,
  cadenceDays,
  issueCount,
  committedPoints,
  actions,
  onClose,
}: SprintDialogProps) {
  const planned = plannedDays(sprint, cadenceDays);
  const [name, setName] = useState(sprint.name);
  const [start, setStart] = useState(planned.start);
  const [end, setEnd] = useState(planned.end);
  const [goal, setGoal] = useState(sprint.goal ?? '');
  const [capacity, setCapacity] = useState(
    sprint.capacityPoints === null ? '' : String(sprint.capacityPoints),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = actions.start.isPending || actions.update.isPending || actions.remove.isPending;
  const datesError = mode === 'start' || (start && end) ? datesProblem(start, end) : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || datesError) return;
    setError(null);
    try {
      if (mode === 'start') {
        await actions.start.mutateAsync({
          sprint,
          name,
          goal,
          startsAt: startOf(start),
          endsAt: endOf(end),
        });
      } else {
        const points = capacity.trim() === '' ? null : Number(capacity);
        await actions.update.mutateAsync({
          id: sprint.id,
          body: {
            name: name.trim(),
            goal: goal.trim() || null,
            startsAt: start ? startOf(start) : null,
            endsAt: end ? endOf(end) : null,
            capacityPoints: points !== null && Number.isFinite(points) ? points : null,
          },
        });
      }
      onClose();
    } catch (failure) {
      setError(message(failure));
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await actions.remove.mutateAsync(sprint.id);
      onClose();
    } catch (failure) {
      setError(message(failure));
    }
  };

  const formId = `sprint-${sprint.id}`;
  const issues = `${issueCount} ${issueCount === 1 ? 'issue' : 'issues'}`;
  return (
    <Modal
      open
      onClose={onClose}
      width="md"
      title={mode === 'start' ? `Start ${sprint.name}` : `Edit ${sprint.name}`}
      description={
        mode === 'start'
          ? `${issues} and ${committedPoints} points are planned for this sprint.`
          : 'Changes apply to the sprint header and the board.'
      }
      footer={
        <>
          {mode === 'edit' && sprint.state === 'future' && (
            <Button
              variant="danger"
              className="mr-auto"
              disabled={busy}
              onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
            >
              {confirmDelete ? `Delete and move ${issues} to the backlog` : 'Delete sprint'}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            loading={busy}
            disabled={!name.trim() || Boolean(datesError)}
          >
            {mode === 'start' ? 'Start sprint' : 'Save'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3.5">
        <Field label="Sprint name">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <FormGrid columns={mode === 'edit' ? 3 : 2} className="max-sm:grid-cols-1">
          <FormGridItem>
            <Field label="Start date">
              <Input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
            </Field>
          </FormGridItem>
          <FormGridItem>
            <Field label="End date" {...(datesError ? { error: datesError } : {})}>
              <Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
            </Field>
          </FormGridItem>
          {mode === 'edit' && (
            <FormGridItem>
              <Field label="Capacity (points)">
                <Input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                />
              </Field>
            </FormGridItem>
          )}
        </FormGrid>
        <Field label="Sprint goal" hint="One sentence the team can check the sprint against.">
          <Textarea rows={2} value={goal} onChange={(event) => setGoal(event.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="m-0 text-12 text-red-tx">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
