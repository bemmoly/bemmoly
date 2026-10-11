import type { MockDb } from '../db.ts';
import { seedWorkBoards, seedWorkProject, seedWorkWorkflows } from '../seed/work-settings.ts';
import { seedWorkRules } from '../seed/work-rules.ts';
import { seedWorkFields, seedWorkIssueTypes, seedWorkTypeFields } from '../seed/work-types.ts';

export type Row = Record<string, unknown> & { id: string };

export interface WorkState {
  project: Row;
  boards: Row[];
  workflows: Row[];
  issueTypes: Row[];
  fields: Row[];
  typeFields: Row[];
  rules: Row[];
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
      rules: seedWorkRules().map((rule) => ({ ...rule, id: rule.name })),
    };
    states.set(db, state);
  }
  return state;
}

export const PROJECT_CONFIGURE = 'work.project.configure';

export const touch = <T extends Row>(row: T, patch: Partial<T>): T =>
  Object.assign(row, patch, { updatedAt: new Date().toISOString() });

/** Custom field values in a PATCH merge into the stored ones, as the server's jsonb || does. */
export function mergeCustomFields(issue: Row, body: Partial<Row>): void {
  const fields = body['customFields'];
  if (fields && typeof fields === 'object') {
    body['customFields'] = { ...(issue['customFields'] as object), ...fields };
  }
}
