import type { Actor, Person, SqlExecutor } from '@bemmoly/core';
import { ConflictError } from '@bemmoly/shared';
import type { JourneyKind, JourneyTemplate, TaskOwner } from '../../../../shared/journeys.ts';
import { addDays } from '../../../../shared/leave-days.ts';
import { pgCode, UNIQUE_VIOLATION, type PeopleServiceDeps } from '../common.ts';

const ownerOf = (owner: TaskOwner, person: Person): string | null => {
  if (owner.type === 'person') return person.userId;
  if (owner.type === 'manager') return person.managerId;
  return owner.userId;
};

/**
 * Starts one journey for a person: a row, and the template's tasks fanned out to their owners
 * with due dates from the anchor. A second open journey of the kind is refused, so an event
 * delivered twice starts it once. Runs in the caller's transaction.
 */
export async function startJourney(
  deps: Pick<PeopleServiceDeps, 'audit'>,
  tx: SqlExecutor,
  actor: Actor,
  input: { person: Person; kind: JourneyKind; template: JourneyTemplate; anchorDate: string },
): Promise<string> {
  const { person, template, anchorDate } = input;
  let id: string;
  try {
    const [row] = await tx<{ id: string }[]>`
      insert into journeys (user_id, kind, template_id, template_name, anchor_date)
      values (${person.userId}, ${input.kind}, ${template.id}, ${template.name}, ${anchorDate})
      returning id`;
    id = row!.id;
  } catch (error) {
    if (pgCode(error) === UNIQUE_VIOLATION) {
      throw new ConflictError(`${person.name} already has an open ${input.kind} journey`);
    }
    throw error;
  }
  const tasks = template.tasks.map((task, position) => ({
    journey_id: id,
    title: task.title,
    owner_id: ownerOf(task.owner, person),
    due_date: addDays(anchorDate, task.offsetDays),
    position,
  }));
  if (tasks.length > 0) {
    await tx`insert into journey_tasks ${tx(tasks, 'journey_id', 'title', 'owner_id', 'due_date', 'position')}`;
  }
  await deps.audit?.record(
    {
      actor,
      action: 'people.journey.started',
      target: { kind: 'journey', id },
      after: { userId: person.userId, kind: input.kind, templateId: template.id, anchorDate },
    },
    tx,
  );
  return id;
}

/** Closes a journey once every task in it is done; reopens it when one is undone. */
export async function settleJourney(tx: SqlExecutor, journeyId: string): Promise<void> {
  await tx`
    update journeys set updated_at = now(), state = case
      when exists (select 1 from journey_tasks where journey_id = ${journeyId} and done_at is null)
        then 'open' else 'done' end
    where id = ${journeyId} and state <> 'cancelled'`;
}
