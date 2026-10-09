# Agent log

Append-only. One line per change or finding, newest at the bottom; read the tail only.

[2026-10-08] Built the integration branch `feat/work-module-integration`: merged W0
(`feat/work-module`) and the six stream branches (projects, issues, workflow, boards, settings,
board) on top of `origin/main`, so a handoff PR carries the whole 0.2.0 work.
[2026-10-08] Resolved the cross-stream conflicts: the module's index files were unioned; the
workflow gate was reconciled with the issues service (the service now calls `transition` and
runs the returned post-actions after commit, and the LQL evaluator takes the request context);
the projects scheme diff stayed canonical and the board-settings mock was adapted to it; the
duplicate `publishWorkflowBodySchema` was removed; rule kinds align on `post_action`; the
duplicate changelog prefixes were renumbered to 0017/0018/0019/0020.
[2026-10-08] Moved the Work API endpoints from `packages/api-client` to
`modules/work/web/src/api` to break the `api-client` ↔ `module-work` package cycle that failed
turbo's task graph.
[2026-10-08] Scoped the server identity test harness to the sample module so Work stays off in
those kernel tests, as it is before an admin enables it.
[2026-10-08] Checks run on Node 24.16.0: typecheck, lint, format:check (tracked files), unit
tests, build, and the integration suites (core, server, module-work) — all green.
[2026-10-08] Next: the remaining Work screens (backlog, issue page and create form, board
settings and workflow editor) plus the Playwright flows in docs/plan/work.md "Integration".
[2026-10-09] Added the boards service: a project's first read creates its board from the org
default board scheme (statuses matched by name) or from its workflow; config is validated
against the workflow's statuses and LQL; WIP-only edits need `work.board.wip`; the board view is
one card statement in rank order with lanes resolved in SQL (`GET /work/boards/:id/view`).
[2026-10-09] Added sprints: start locks the project row so a Scrum project has one active
sprint and writes the commitment to `sprint_metrics`; complete moves unfinished issues to the
backlog, the next or a chosen sprint and writes the completion snapshot to the sprint and to
`sprint_metrics`. Kanban projects cannot start sprints.
[2026-10-09] Added the backlog read (`GET /work/projects/:key/backlog`) and
`POST /work/issues/:key/move`, which validates the target sprint and then calls the issue
service's rank, so lexorank, history and invalidations stay in one place.
[2026-10-09] Added saved filters at `/work/filters`: visible to the owner and to members of the
teams they are shared with, changed by the owner only, queries checked with the LQL validator.
[2026-10-09] Added metrics: burndown rebuilt from issue history, cycle time and throughput from
status changes, velocity from completion snapshots; cached per board in `sprint_metrics` under a
key of the latest project change and the day (`GET /work/boards/:id/metrics`,
`GET /work/sprints/:id/report`). No schema changeset was needed.
[2026-10-09] Finding: the web client in `modules/work/web/src/api/board-issues.ts` calls
`POST /work/issues/:key/rank` and `/transition`, which the server serves as `PATCH .../rank` and
not at all; the Board stream should align with the issue routes.
[2026-10-09] Checks on Node 24.21.0: module typecheck, lint and unit tests, the module's
integration suite (7 tests) and format:check, all green.
[2026-10-09] Work web: client calls for issues, comments, links, watchers, work logs, history,
transitions and the project catalog, by key as the server's routes are.
[2026-10-09] Work web: the Issue page from the Issue mock and the same body as IssueSlideOver in
the design system's drawer, exported from `modules/work/web/src/issue` for the Board.
[2026-10-09] Work web: the create issue form laid out from the type's layout, opened from the top
bar's Create menu through the module's `create` navigation entries.
[2026-10-09] Work web: the project list, the create project dialog and the ProjectSwitcher.
[2026-10-09] UI: a ghost variant of the Select for values edited in place.
[2026-10-09] Mocks: work issue, activity and project routes with the Issue mock's data.
