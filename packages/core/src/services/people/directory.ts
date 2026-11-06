import type { PersonDirectory } from '../../contracts/people.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import {
  chainRows,
  costCentreRow,
  filteredRows,
  locationRow,
  personRow,
  personRows,
  reportRows,
  toCostCentre,
  toLocation,
  toPerson,
} from './repository.ts';

/**
 * The read side other products use. No authorization here: the directory is open to anyone
 * signed in (ADR 0050), and a module decides what of it to show.
 */
export function createPersonDirectory(pool: SqlExecutor): PersonDirectory {
  return {
    async get(userId, transaction = pool) {
      const row = await personRow(transaction, userId);
      return row ? toPerson(row) : null;
    },
    async getMany(userIds, transaction = pool) {
      return (await personRows(transaction, userIds)).map(toPerson);
    },
    async managerChain(userId, transaction = pool) {
      return (await chainRows(transaction, userId)).map(toPerson);
    },
    async reports(userId, options = {}, transaction = pool) {
      return (await reportRows(transaction, userId, options.all ?? false)).map(toPerson);
    },
    async list(filter, transaction = pool) {
      return (await filteredRows(transaction, filter)).map(toPerson);
    },
    async location(id, transaction = pool) {
      const row = await locationRow(transaction, id);
      return row ? toLocation(row) : null;
    },
    async costCentre(id, transaction = pool) {
      const row = await costCentreRow(transaction, id);
      return row ? toCostCentre(row) : null;
    },
  };
}
