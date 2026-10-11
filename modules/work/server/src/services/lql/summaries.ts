import type { SqlClient, SqlFragment } from '@bemmoly/core';
import type { IssueSummary } from '../../../../shared/issues.ts';

/*
 * An issue as a row in another module draws it. The names behind the type,
 * status and assignee ids come from correlated lookups in the select list, so
 * a page of summaries is one statement however many rows it holds. The output
 * names carry a suffix so they never shadow a column the query sorts on.
 */
export interface IssueSummaryRow {
  id: string;
  key: string;
  title: string;
  type_ref: IssueSummary['type'];
  status_ref: IssueSummary['status'];
  assignee_ref: IssueSummary['assignee'];
}

export function summaryColumns(sql: SqlClient): SqlFragment {
  return sql`issues.id, issues.key, issues.title,
    (select jsonb_build_object('id', t.id, 'key', t.key, 'name', t.name, 'level', t.level,
       'icon', t.icon) from issue_types t where t.id = issues.type_id) as type_ref,
    (select jsonb_build_object('id', s.id, 'name', s.name, 'category', s.category)
       from workflow_statuses s where s.id = issues.status_id) as status_ref,
    (select jsonb_build_object('id', u.id, 'name', u.name)
       from users u where u.id = issues.assignee_id) as assignee_ref`;
}

export function toIssueSummary(row: IssueSummaryRow): IssueSummary {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    type: row.type_ref,
    status: row.status_ref,
    assignee: row.assignee_ref,
  };
}
