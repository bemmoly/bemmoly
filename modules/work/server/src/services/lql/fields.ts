import type { SqlClient, SqlFragment } from '@bemmoly/core';
import type { LqlOperator, Value } from '@bemmoly/shared';
import { ISSUE_PRIORITIES } from '../../../../shared/enums.ts';
import {
  compare,
  datePredicate,
  existsPredicate,
  lookupPredicate,
  numberPredicate,
  textPredicate,
  type Lookup,
} from './predicates.ts';
import { meOf, textOf, type ValueContext } from './values.ts';

/*
 * Every built-in issue field of the catalog mapped to the `issues` row the
 * statement selects from. Reference fields resolve names through subqueries
 * rather than joins so a compiled predicate drops into any statement that
 * selects from `issues`, including the board view and a workflow condition.
 */

export interface FieldCompiler {
  predicate(sql: SqlClient, operator: LqlOperator, values: Value[], cx: ValueContext): SqlFragment;
  /** The expression ORDER BY sorts on. */
  sort(sql: SqlClient): SqlFragment;
}

const lower = (names: string[]) => names.map((name) => name.toLowerCase());
const upper = (names: string[]) => names.map((name) => name.toUpperCase());

const byName =
  (lookup: (sql: SqlClient, names: string[]) => SqlFragment): Lookup =>
  (sql, values) =>
    lookup(sql, lower(values.map(textOf)));
const byKey =
  (lookup: (sql: SqlClient, keys: string[]) => SqlFragment): Lookup =>
  (sql, values) =>
    lookup(sql, upper(values.map(textOf)));

const statuses = byName(
  (sql, names) => sql`select id from workflow_statuses where lower(name) = any(${names}::text[])`,
);
const categories = byName(
  (sql, names) => sql`select id from workflow_statuses where category = any(${names}::text[])`,
);
const types = byName(
  (sql, names) =>
    sql`select id from issue_types
      where lower(key) = any(${names}::text[]) or lower(name) = any(${names}::text[])`,
);
const versions = byName(
  (sql, names) => sql`select id from versions where lower(name) = any(${names}::text[])`,
);
const projects = byKey((sql, keys) => sql`select id from projects where key = any(${keys}::text[])`);
const issuesByKey = byKey((sql, keys) => sql`select id from issues where key = any(${keys}::text[])`);
const epicsByKey = byKey(
  (sql, keys) => sql`select e.id from issues e join issue_types t on t.id = e.type_id
    where e.key = any(${keys}::text[]) and t.level = 'epic'`,
);

/**
 * People are named by email or display name; `me` is bound as the actor's id.
 * Both forms may appear in one IN list, so the subquery takes both.
 */
function users(sql: SqlClient, values: Value[], cx: ValueContext): SqlFragment {
  const ids = values.filter((value) => value.kind === 'me').map(() => meOf(cx));
  const names = lower(values.filter((value) => value.kind !== 'me').map(textOf));
  return sql`select id from users
    where id = any(${ids}::uuid[])
      or lower(email) = any(${names}::text[]) or lower(name) = any(${names}::text[])`;
}

/** Sprints by name, or the project's active sprint for `currentSprint()`. */
function sprints(sql: SqlClient, values: Value[]): SqlFragment {
  const names = lower(values.filter((value) => value.kind !== 'function').map(textOf));
  const current = values.some((value) => value.kind === 'function');
  const named = sql`select id from sprints where lower(name) = any(${names}::text[])`;
  if (!current) return named;
  const active = sql`select id from sprints
    where state = 'active' and project_id = issues.project_id`;
  return names.length === 0 ? active : sql`${named} union ${active}`;
}

const reference =
  (column: SqlFragment, lookup: Lookup): FieldCompiler['predicate'] =>
  (sql, operator, values, cx) =>
    lookupPredicate(sql, column, operator, values, cx, lookup);

type NamedTable = 'sprints' | 'versions' | 'users' | 'issue_types';

/** The display name behind a reference column, for ORDER BY on reference fields. */
function subqueryName(sql: SqlClient, table: NamedTable, column: SqlFragment): SqlFragment {
  switch (table) {
    case 'sprints':
      return sql`(select name from sprints where id = ${column})`;
    case 'versions':
      return sql`(select name from versions where id = ${column})`;
    case 'users':
      return sql`(select name from users where id = ${column})`;
    case 'issue_types':
      return sql`(select name from issue_types where id = ${column})`;
  }
}

function keyPredicate(sql: SqlClient, operator: LqlOperator, values: Value[]): SqlFragment {
  const keys = upper(values.map(textOf));
  switch (operator) {
    case '=':
    case 'IN':
      return sql`issues.key = any(${keys}::text[])`;
    case '!=':
    case 'NOT IN':
      return sql`issues.key <> all(${keys}::text[])`;
    default:
      return textPredicate(sql, sql`issues.key`, operator, values);
  }
}

/** Lowest first, so `priority > High` reads as "more urgent than High". */
const PRIORITY_ORDER = [...ISSUE_PRIORITIES].reverse();

const priorityRank = (sql: SqlClient, value: SqlFragment) =>
  sql`array_position(${PRIORITY_ORDER}::text[], ${value})`;

function priorityPredicate(
  sql: SqlClient,
  operator: LqlOperator,
  values: Value[],
): SqlFragment {
  const names = lower(values.map(textOf));
  switch (operator) {
    case '=':
    case 'IN':
      return sql`issues.priority = any(${names}::text[])`;
    case '!=':
    case 'NOT IN':
      return sql`issues.priority <> all(${names}::text[])`;
    default:
      return compare(
        sql,
        priorityRank(sql, sql`issues.priority`),
        operator,
        priorityRank(sql, sql`${names[0] ?? null}::text`),
      );
  }
}

function labelPredicate(sql: SqlClient, operator: LqlOperator, values: Value[]): SqlFragment {
  const names = lower(values.map(textOf));
  const matching = sql`select 1 from issue_labels il join labels l on l.id = il.label_id
    where il.issue_id = issues.id and lower(l.name) = any(${names}::text[])`;
  const any = sql`select 1 from issue_labels il where il.issue_id = issues.id`;
  return existsPredicate(sql, operator, matching, any);
}

const id = (sql: SqlClient) => sql`issues.id`;
const col = (column: SqlFragment): FieldCompiler['sort'] => () => column;

export function builtInFields(sql: SqlClient): Record<string, FieldCompiler> {
  const statusId = sql`issues.status_id`;
  const typeId = sql`issues.type_id`;
  const assigneeId = sql`issues.assignee_id`;
  const reporterId = sql`issues.reporter_id`;
  const sprintId = sql`issues.sprint_id`;
  const versionId = sql`issues.fix_version_id`;
  const text = sql`concat_ws(' ', issues.key, issues.title, issues.description_text)`;
  return {
    project: {
      predicate: reference(sql`issues.project_id`, projects),
      sort: col(sql`(select key from projects where id = issues.project_id)`),
    },
    key: {
      predicate: (s, operator, values) => keyPredicate(s, operator, values),
      sort: col(sql`issues.number`),
    },
    type: {
      predicate: reference(typeId, types),
      sort: () => subqueryName(sql, 'issue_types', typeId),
    },
    status: {
      predicate: reference(statusId, statuses),
      sort: col(sql`(select position from workflow_statuses where id = issues.status_id)`),
    },
    statusCategory: {
      predicate: reference(statusId, categories),
      sort: col(sql`(select category from workflow_statuses where id = issues.status_id)`),
    },
    priority: {
      predicate: (s, operator, values) => priorityPredicate(s, operator, values),
      sort: () => priorityRank(sql, sql`issues.priority`),
    },
    assignee: {
      predicate: reference(assigneeId, users),
      sort: () => subqueryName(sql, 'users', assigneeId),
    },
    reporter: {
      predicate: reference(reporterId, users),
      sort: () => subqueryName(sql, 'users', reporterId),
    },
    parent: { predicate: reference(sql`issues.parent_id`, issuesByKey), sort: id },
    epic: { predicate: reference(sql`issues.parent_id`, epicsByKey), sort: id },
    sprint: {
      predicate: reference(sprintId, sprints),
      sort: () => subqueryName(sql, 'sprints', sprintId),
    },
    estimate: {
      predicate: (s, operator, values) => numberPredicate(s, sql`issues.estimate`, operator, values),
      sort: col(sql`issues.estimate`),
    },
    due: {
      predicate: (s, operator, values, cx) =>
        datePredicate(s, sql`issues.due_at`, operator, values, cx),
      sort: col(sql`issues.due_at`),
    },
    created: {
      predicate: (s, operator, values, cx) =>
        datePredicate(s, sql`issues.created_at`, operator, values, cx),
      sort: col(sql`issues.created_at`),
    },
    updated: {
      predicate: (s, operator, values, cx) =>
        datePredicate(s, sql`issues.updated_at`, operator, values, cx),
      sort: col(sql`issues.updated_at`),
    },
    fixVersion: {
      predicate: reference(versionId, versions),
      sort: () => subqueryName(sql, 'versions', versionId),
    },
    label: {
      predicate: (s, operator, values) => labelPredicate(s, operator, values),
      sort: id,
    },
    text: {
      predicate: (s, operator, values) => textPredicate(s, text, operator, values),
      sort: col(sql`issues.title`),
    },
  };
}
