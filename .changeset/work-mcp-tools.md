---
'@bemmoly/module-work': minor
---

Work's MCP and planner tools cover a migration end to end. Creating an issue returns its key,
id and link, and takes custom fields, a starting status by name or id (any status of the
project's workflow, as an import places issues; a done status marks the issue resolved), an
assignee by email, a parent by key and a Markdown description of up to 100,000 characters.
`work_get_project` lists each issue type's fields and which are required, and a missing required
field is named in the error. New tools: `work_update_issue`, `work_delete_issue`,
`work_link_issues`, `work_list_statuses`, `work_list_projects` and `work_create_project`.
`work_search_issues` returns each issue's type, parent and description as Markdown. Comments
take Markdown of the same length. The create issue API accepts an optional `statusId` the same
way. No schema or configuration change.
