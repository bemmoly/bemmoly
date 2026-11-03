import type { RequestContext } from '@bemmoly/core';
import type {
  SetupChecklistResponse,
  StartOverBody,
  StartOverResponse,
} from '../../../../shared/pipeline-setup.ts';
import {
  authorizePipelines,
  requireAccess,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { readChecklist } from './checklist.ts';
import { startOver } from './reset.ts';

/** The fresh-install checklist on For you, and Start over in Platform › Settings. */
export function createSetupChecklistService(deps: PipelinesServiceDeps) {
  const sql = () => requireDatabase(deps);
  return {
    async checklist(ctx: RequestContext): Promise<SetupChecklistResponse> {
      await authorizePipelines(ctx);
      return readChecklist(sql());
    },

    async startOver(ctx: RequestContext, _body: StartOverBody): Promise<StartOverResponse> {
      await requireAccess(deps).authorizeAction(ctx, 'platform', {
        scope: { kind: 'organisation' },
      });
      return { removed: await sql().begin((tx) => startOver(tx)) };
    },
  };
}

export type SetupChecklistService = ReturnType<typeof createSetupChecklistService>;
