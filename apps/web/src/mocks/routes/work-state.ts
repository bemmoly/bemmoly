import type { MockDb } from '../db.ts';
import {
  seedWorkBoards,
  seedWorkProject,
  seedWorkWorkflows,
  STATUS_COUNTS,
} from '../seed/work-settings.ts';
import {
  seedWorkFields,
  seedWorkIssueTypes,
  seedWorkRules,
  seedWorkTypeFields,
} from '../seed/work-types.ts';

export type Row = Record<string, unknown> & { id: string };

export interface WorkState {
  project: Row;
  boards: Row[];
  workflows: Row[];
  issueTypes: Row[];
  fields: Row[];
  typeFields: Row[];
  rules: Row[];
  statusCounts: Record<string, number>;
}

/**
 * The Work settings rows beside the kernel's mock database, keyed by it so a
 * scenario reset starts them over too and the kernel's db shape stays the
 * identity stream's. Edits live for the page's life, which is what the
 * settings screens need to be exercised.
 */
const states = new WeakMap<MockDb, WorkState>();

export function workState(db: MockDb): WorkState {
  let state = states.get(db);
  if (!state) {
    state = {
      project: seedWorkProject() as Row,
      boards: seedWorkBoards() as Row[],
      workflows: seedWorkWorkflows() as Row[],
      issueTypes: seedWorkIssueTypes() as Row[],
      fields: seedWorkFields() as Row[],
      typeFields: seedWorkTypeFields() as Row[],
      rules: seedWorkRules().map((rule, index) => ({ ...rule, id: String(index) })),
      statusCounts: { ...STATUS_COUNTS },
    };
    states.set(db, state);
  }
  return state;
}

export const PROJECT_CONFIGURE = 'work.project.configure';

export const touch = <T extends Row>(row: T, patch: Partial<T>): T =>
  Object.assign(row, patch, { updatedAt: new Date().toISOString() });
