import type { JobDefinition } from '@bemmoly/core';
import { MOVE_SECRETS_JOB, type VariablesService } from '../services/variables/index.ts';

/**
 * pipelines.variables-move: writes values from before secrets existed into the secret store
 * and clears them from the database. Every ten minutes, one replica at a time; a value that
 * cannot move yet (no cloud connected, no project chosen) keeps its reason and waits. A deploy
 * that needs one moves it first, so nothing waits on this schedule to ship.
 */
export function moveSecretsJob(variables: Pick<VariablesService, 'moveUnmoved'>): JobDefinition {
  return {
    name: MOVE_SECRETS_JOB,
    schedule: '*/10 * * * *',
    singleton: true,
    retryLimit: 0,
    expireInSeconds: 15 * 60,
    handle: async () => {
      await variables.moveUnmoved();
    },
  };
}
