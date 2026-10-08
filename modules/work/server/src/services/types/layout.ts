import type { SqlClient } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { IssueTypeField, PutIssueTypeFieldsBody } from '../../../../shared/issue-types.ts';
import { toIssueTypeField, type IssueTypeFieldRow } from './rows.ts';

export async function readLayout(sql: SqlClient, issueTypeId: string): Promise<IssueTypeField[]> {
  const rows = await sql<IssueTypeFieldRow[]>`
    select id, issue_type_id, field_id, required, on_card, position from issue_type_fields
    where issue_type_id = ${issueTypeId} order by position, id`;
  return rows.map(toIssueTypeField);
}

/**
 * The create form is edited as a whole: the body is the full layout in
 * order, so rows left out are removed and positions follow the array.
 */
export async function putLayout(
  sql: SqlClient,
  issueTypeId: string,
  items: PutIssueTypeFieldsBody['items'],
): Promise<IssueTypeField[]> {
  const fieldIds = items.map((item) => item.fieldId);
  if (new Set(fieldIds).size !== fieldIds.length) {
    throw new ValidationError('A field appears twice in the layout');
  }
  return sql.begin(async (tx) => {
    const [count] = await tx<{ n: number }[]>`
      select count(*)::int as n from fields where id = any(${fieldIds}::uuid[])`;
    if ((count?.n ?? 0) !== fieldIds.length) {
      throw new ValidationError('The layout names a field that does not exist');
    }
    await tx`
      delete from issue_type_fields
      where issue_type_id = ${issueTypeId} and not (field_id = any(${fieldIds}::uuid[]))`;
    for (const [position, item] of items.entries()) {
      await tx`
        insert into issue_type_fields (issue_type_id, field_id, required, on_card, position)
        values (${issueTypeId}, ${item.fieldId}, ${item.required ?? false},
          ${item.onCard ?? false}, ${position})
        on conflict (issue_type_id, field_id) do update
          set required = excluded.required, on_card = excluded.on_card,
            position = excluded.position, updated_at = now()`;
    }
    return readLayout(tx as unknown as SqlClient, issueTypeId);
  }) as Promise<IssueTypeField[]>;
}
