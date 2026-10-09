import { can, emit, type MockDb } from '../db.ts';
import { bodyOf, fail, notFound, ok, type MockRoute } from '../types.ts';
import { PROJECT_CONFIGURE, touch, workState, type Row } from './work-state.ts';

/*
 * The board reads and writes of Board settings, in the server's shapes: the
 * org default board scheme a project's copy is compared with, a board by id,
 * and the board save with the server's split between "Edit WIP limits" and
 * "Configure board".
 */

const BOARD_CONFIGURE = 'work.board.configure';
const BOARD_WIP = 'work.board.wip';

/** The roles matrix seed predates the board capabilities; project admins hold both. */
const canConfigure = (db: MockDb) => can(db, BOARD_CONFIGURE) || can(db, PROJECT_CONFIGURE);
const canWip = (db: MockDb) => can(db, BOARD_WIP) || canConfigure(db);

type Config = Record<string, unknown> & { columns?: Array<Record<string, unknown>> };

/** The server's rule: only column WIP limits differ, so "Edit WIP limits" is enough. */
function onlyWip(before: Config, after: Config): boolean {
  if (before.columns?.length !== after.columns?.length) return false;
  const strip = (config: Config) =>
    JSON.stringify({
      ...config,
      columns: (config.columns ?? []).map((column) => ({ ...column, wipLimit: null })),
    });
  return strip(before) === strip(after);
}

export const workSettingsBoardRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/work/boards',
    handle: (_, db) =>
      ok({ items: workState(db).boards.filter((row) => row['projectId'] === null) }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/work/boards/:id',
    handle: (request, db) => {
      const row = workState(db).boards.find((item) => item.id === request.params['id']);
      return row ? ok(row) : notFound('Board');
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/work/boards/:id',
    handle: (request, db) => {
      const row = workState(db).boards.find((item) => item.id === request.params['id']);
      if (!row) return notFound('Board');
      const body = bodyOf<Row>(request);
      const config = (body['config'] ?? row['config']) as Config;
      const wipOnly = body['name'] === undefined && onlyWip(row['config'] as Config, config);
      if (!(wipOnly ? canWip(db) : canConfigure(db))) {
        return fail(
          403,
          'forbidden',
          `You need "${wipOnly ? 'Edit WIP limits' : 'Configure board'}" to do that.`,
        );
      }
      touch(row, body);
      emit(db, 'work.boards.updated', [row.id]);
      return ok(row);
    },
  },
];
