import {
  updaterRollbackRequestSchema,
  updaterUpdateRequestSchema,
  type UpdaterStatus,
} from '@bemmoly/shared';
import { timingSafeEqual } from 'node:crypto';
import type { UpdaterContext } from '../services/context.ts';
import { renderProgressPage } from '../services/progress-page.ts';
import { runRollback } from '../services/rollback.ts';
import { readState } from '../services/state.ts';
import { runUpdate } from '../services/update.ts';

export interface Reply {
  status: number;
  body: unknown;
  html?: boolean;
}

export function tokenMatches(header: string | undefined, token: string): boolean {
  const presented = Buffer.from(header?.replace(/^Bearer\s+/i, '') ?? '');
  const expected = Buffer.from(token);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

/** Starts work after replying 202; the outcome is in the state file and /v1/status. */
function inBackground(
  ctx: UpdaterContext,
  label: string,
  work: () => Promise<UpdaterStatus>,
): void {
  work().catch((error: unknown) => ctx.log(`${label} ended with an error: ${String(error)}`));
}

export function createUpdaterController(ctx: UpdaterContext) {
  let busy = false;
  const exclusive = (label: string, work: () => Promise<UpdaterStatus>) => {
    busy = true;
    inBackground(ctx, label, () => work().finally(() => (busy = false)));
  };
  return {
    async status(): Promise<Reply> {
      return { status: 200, body: await readState(ctx.env.BEMMOLY_DIR) };
    },
    async update(body: unknown): Promise<Reply> {
      const parsed = updaterUpdateRequestSchema.safeParse(body);
      if (!parsed.success)
        return {
          status: 400,
          body: { code: 'validation_failed', message: 'tag must be a release version' },
        };
      if (busy)
        return {
          status: 409,
          body: { code: 'conflict', message: 'An update or rollback is already running' },
        };
      exclusive('update', () => runUpdate(ctx, parsed.data.tag));
      return {
        status: 202,
        body: { accepted: true, operation: 'update', target: parsed.data.tag },
      };
    },
    async rollback(body: unknown): Promise<Reply> {
      const parsed = updaterRollbackRequestSchema.safeParse(body ?? {});
      if (!parsed.success)
        return {
          status: 400,
          body: { code: 'validation_failed', message: 'invalid rollback request' },
        };
      if (busy)
        return {
          status: 409,
          body: { code: 'conflict', message: 'An update or rollback is already running' },
        };
      const state = await readState(ctx.env.BEMMOLY_DIR);
      exclusive('rollback', () =>
        runRollback(ctx, {
          preferRestore: parsed.data.preferRestore,
          ...(parsed.data.expectedMode ? { expectedMode: parsed.data.expectedMode } : {}),
        }),
      );
      return {
        status: 202,
        body: { accepted: true, operation: 'rollback', target: state.previous ?? '' },
      };
    },
    async progressPage(): Promise<Reply> {
      return {
        status: 503,
        body: renderProgressPage(await readState(ctx.env.BEMMOLY_DIR)),
        html: true,
      };
    },
  };
}

export type UpdaterController = ReturnType<typeof createUpdaterController>;
