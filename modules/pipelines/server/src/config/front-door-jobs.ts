import type { JobDefinition, JobRegistry } from '@bemmoly/core';
import { z } from 'zod';
import { FRONT_DOOR_APPLY_JOB, type FrontDoorsService } from '../services/front-doors/index.ts';
import type { MoveEngine } from '../services/moves/engine.ts';

/*
 * Front doors' and runtime moves' jobs: applying one front door when it changes, one wake-up
 * per move at the moment it next has something to do, and a minute sweep behind both. The
 * engine leases each move for a step, so a wake-up that arrives twice does nothing twice.
 */

export const MOVE_ADVANCE_JOB = 'pipelines.move-advance';
export const FRONT_DOORS_SWEEP_JOB = 'pipelines.front-doors-sweep';

const idSchema = z.object({ id: z.uuid() });

export function moveWaker(jobs: Pick<JobRegistry, 'send'>) {
  return async (id: string, at: Date) => {
    await jobs.send(
      MOVE_ADVANCE_JOB,
      { id },
      { startAfter: at, idempotencyKey: `move:${id}:${at.toISOString()}` },
    );
  };
}

export function frontDoorJobs(
  frontDoors: FrontDoorsService,
  engine: () => MoveEngine | null,
): JobDefinition[] {
  return [
    {
      name: FRONT_DOOR_APPLY_JOB,
      concurrency: 2,
      retryLimit: 2,
      expireInSeconds: 900,
      handle: async (payload) => {
        await frontDoors.apply(idSchema.parse(payload).id);
      },
    },
    {
      name: MOVE_ADVANCE_JOB,
      concurrency: 4,
      retryLimit: 3,
      expireInSeconds: 300,
      handle: async (payload) => {
        await engine()?.advance(idSchema.parse(payload).id);
      },
    },
    {
      name: FRONT_DOORS_SWEEP_JOB,
      schedule: '* * * * *',
      singleton: true,
      retryLimit: 0,
      expireInSeconds: 600,
      handle: async () => {
        await frontDoors.sweep();
        await engine()?.sweep();
      },
    },
  ];
}
