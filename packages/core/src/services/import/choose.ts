import {
  ConflictError,
  type ImportContainerPage,
  type ImportContainerQuery,
  type ImportCountBody,
  type ImportCountList,
  type ImportSelectionBody,
  type ImportSelectionSummary,
} from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Importer, ImportSourceContext } from '../../contracts/importer.ts';
import { openConnection } from './connection.ts';
import {
  applySelectionOps,
  containerRefs,
  countsOf,
  listContainers,
  saveCounts,
  selectionSummary,
} from './containers.ts';
import { jobById } from './store.ts';
import type { SecretBox } from '../settings/index.ts';

/*
 * Choose: the containers a connection found, a page at a time; counts for the rows coming
 * into view, asked of the source once and kept; and the selection, changed by operations.
 * The caller has authorised the actor; these only read and write the job's rows.
 */

export interface ChooseDeps {
  sql: SqlClient;
  secrets: SecretBox;
  importerFor(source: string): Importer;
  sourceContext(): ImportSourceContext;
}

const ACTIVE = new Set(['queued', 'running']);

export function createChooser(deps: ChooseDeps) {
  const { sql } = deps;
  return {
    async containers(id: string, query: ImportContainerQuery): Promise<ImportContainerPage> {
      await jobById(sql, id);
      return listContainers(sql, id, query);
    },

    /**
     * Counts what is not counted yet among these rows, through the source, and keeps the
     * answers on the rows; rows already counted come from the table without a call.
     */
    async count(id: string, body: ImportCountBody): Promise<ImportCountList> {
      const row = await jobById(sql, id);
      const importer = deps.importerFor(row.source);
      const missing = await containerRefs(sql, id, body.ids, true);
      if (missing.length && importer.count) {
        const counted = await importer.count(
          openConnection(row, deps.secrets),
          missing,
          deps.sourceContext(),
        );
        await saveCounts(sql, id, counted);
      }
      return { items: await countsOf(sql, id, body.ids) };
    },

    async selection(id: string): Promise<ImportSelectionSummary> {
      await jobById(sql, id);
      return selectionSummary(sql, id);
    },

    async select(id: string, body: ImportSelectionBody): Promise<ImportSelectionSummary> {
      return sql.begin(async (tx) => {
        const [row] = await tx<{ status: string }[]>`
          select status from import_jobs where id = ${id} for update`;
        if (!row) await jobById(tx, id);
        if (row && ACTIVE.has(row.status)) throw new ConflictError('The import is running');
        await applySelectionOps(tx, id, body.ops);
        return selectionSummary(tx, id);
      });
    },
  };
}

export type Chooser = ReturnType<typeof createChooser>;
