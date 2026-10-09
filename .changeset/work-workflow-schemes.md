---
'@bemmoly/module-work': minor
'@bemmoly/web': patch
---

The workflow editor shows how many issues sit in each status, counting only projects that use
the workflow and issues you can open (`GET /api/v1/work/workflows/:id/status-counts`, with an
optional `projectId`); Board settings uses the same counts to warn before a change hides
cards. Publishing a workflow now records when it was published, shown in the Workflows list
in place of the last change, and keeps where each status was drawn, so a published workflow
opens with its layout. A project's own copy of a workflow now takes the project's issues and
board columns with it.

Project settings can override and reset each scheme: issue types, fields, the workflow and the
board (`GET /api/v1/work/projects/:key/schemes`, `GET …/schemes/:kind/diff`, `POST
…/schemes/:kind/override` and `…/reset`). Overriding copies the org default into the project
and moves its issues onto the copy; resetting moves them back and drops the copy, and the diff
lists every row the project changed. A project's issue type or field copy can now be edited by
its id alone.

Schema change: changeset `0021-work-workflow-publish-details` adds `workflows.published_at`
and nullable `x` and `y` columns on `workflow_statuses`. It is fast, fills the publish time of
existing workflows from their last update, and can be rolled back.
