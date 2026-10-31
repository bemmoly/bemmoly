import type {
  DomainEvent,
  JobDefinition,
  JobRegistry,
  ModuleContext,
  SqlClient,
} from '@bemmoly/core';
import type { ApprovalEventPayload } from '@bemmoly/shared/approvals';
import type { PersonJoinedPayload, PersonLeavingPayload } from '@bemmoly/shared/people';
import { z } from 'zod';
import { journeyKindSchema } from '../../../shared/journeys.ts';
import type { JourneysService } from '../services/journeys/index.ts';
import { applyOutcome, LEAVE_OUTCOME_EVENTS } from '../services/leave/index.ts';

export const START_JOURNEY_JOB = 'people.start-journey';

const startPayloadSchema = z.object({
  kind: journeyKindSchema,
  userId: z.uuid(),
  anchorDate: z.iso.date(),
});

/** people.start-journey: starts the matching template's journey; a second run starts none. */
export function startJourneyJob(journeys: Pick<JourneysService, 'startForEvent'>): JobDefinition {
  return {
    name: START_JOURNEY_JOB,
    retryLimit: 3,
    handle: async (payload) => {
      const { kind, userId, anchorDate } = startPayloadSchema.parse(payload);
      await journeys.startForEvent(kind, userId, anchorDate);
    },
  };
}

/**
 * The kernel's lifecycle events start journeys and the approval engine's outcomes settle
 * leave. Journeys are queued in the writing transaction, so they start only once the person
 * record they read has committed.
 */
export function subscribePeopleEvents(
  ctx: Pick<ModuleContext, 'events'>,
  jobs: Pick<JobRegistry, 'send'>,
  database: SqlClient | undefined,
) {
  const queue = async (
    event: DomainEvent,
    kind: 'onboarding' | 'offboarding',
    userId: string,
    anchorDate: string | null,
  ) => {
    if (!anchorDate) return;
    await jobs.send(
      START_JOURNEY_JOB,
      { kind, userId, anchorDate },
      {
        idempotencyKey: `${kind}:${userId}:${anchorDate}`,
        ...(event.transaction ? { transaction: event.transaction } : {}),
      },
    );
  };
  ctx.events.subscribe('person.joined', async (event) => {
    const payload = event.payload as PersonJoinedPayload;
    await queue(event, 'onboarding', payload.userId, payload.startDate);
  });
  ctx.events.subscribe('person.leaving', async (event) => {
    const payload = event.payload as PersonLeavingPayload;
    await queue(event, 'offboarding', payload.userId, payload.endDate);
  });
  for (const kind of LEAVE_OUTCOME_EVENTS) {
    ctx.events.subscribe(kind, async (event) => {
      const sql = event.transaction ?? database;
      if (sql) await applyOutcome(sql, kind, event.payload as ApprovalEventPayload);
    });
  }
}
