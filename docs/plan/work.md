# Work module release (0.2.0): plan

Companion to `docs/tech-design.html` (v0.10, sections 8, 14 and 16) and the successor to
`foundation.md`. The Work release is the first module built on the kernel 0.1 proved with the
`sample` module. It ships as `modules/work`, imports only `@bemmoly/core`, and stays off until an
admin enables it. Nothing in `packages/core` learns what an issue is.

## What you will be able to do with 0.2.0

1. Enable Work from Settings › Modules. Its changelog runs, "Board" and "Backlog" appear in the
   top nav, and the Work capabilities appear in the roles matrix with their org locks.
2. Create a project with a key, pick Scrum or Kanban, and inherit the org default issue types,
   fields, workflow and board scheme. Override any of them per project and view the diff.
3. Create issues with the create form laid out per type: title, description, acceptance
   criteria, subtasks, links (blocks, relates, duplicates), labels, fix version, estimate,
   custom fields. Every issue gets a gap-free key such as `PLT-142`.
4. Open the Issue page: description, acceptance criteria, subtasks, linked issues, comments with
   reactions and threads, history, work log, watchers, custom fields. The AI panels render
   their empty state; AI itself arrives in 0.4.
5. Move issues through a workflow whose transitions carry conditions, validators and post-actions,
   edited in the visual workflow editor and published as a version.
6. Plan in the Backlog: sprint containers, drag and drop with lexorank, the epic panel, capacity
   against committed points. Start and close sprints; closing writes the velocity snapshot.
7. Work on the Board in Scrum or Kanban mode: columns mapped to statuses, WIP limits, swimlanes
   by epic, assignee, priority or an LQL query, quick filters, card field layout and colour
   rules, flow metrics. The slide-over opens an issue without leaving the board.
8. Write LQL in a filter bar with validation and autocomplete, and save filters shared with a
   team.
9. Search issues by keyword and key prefix from ⌘K, filtered by project access.
10. Receive inbox and email notifications for assignments, mentions, comments and transitions,
    with the board and issue page updating live over the WebSocket.
11. See "my work" on Home: assigned, reported and watched issues.

Quality bar: Board, Backlog, Issue, Board settings and Workflow screens match the mocks; board
p95 under the budget in section 20; the module boots and passes its tests with Docs absent;
CI gates unchanged and green.

Not in 0.2.0: AI summaries, sprint pulse and planning tips (0.4), roadmap and forecast (0.5),
importers, automation rules (schema lands now, the engine in 0.5), attachments beyond the kernel
object store, custom field expression indexes (the filterable flag is stored; the generated
index arrives with the first importer).

## Order of work

### W0 Contracts (parallel, three agents, first)

Every later stream codes against these, so they land before anything else.

- `modules/work` skeleton in the shape of `modules/sample`: `module.ts` registering navigation,
  capabilities, settings, jobs and routes; `changelog/` with every table from tech design
  section 8 "Work", indexes in the same changeset, `down` where reversible; `shared/` with the
  zod schemas for every entity, request body and response; the module registered in
  `apps/server` and a placeholder chunk in `apps/web`. Capabilities, with org locks, are read
  from the People mock's roles matrix.
- LQL in `packages/shared/src/lql`: tokenizer, grammar, AST, parser, validator and
  autocomplete, with the error shape the filter bar renders. No SQL here.
- Work components in `packages/ui`, ported from the five Work mocks: kanban column and card,
  issue key, priority and type glyphs, sprint header, capacity bar, column and lane headers,
  transition arrow and status node for the workflow canvas, slide-over frame, filter bar.
  Storybook stories beside the mock, as the foundation components have.

### Parallel workstreams (one agent each, own worktree, own folders)

| Stream | Owns | Delivers |
|---|---|---|
| A. Projects and schemes | `modules/work/server/src/services/{projects,types,fields,labels,versions}` and their routes and controllers | Projects with keys and counters, org default and per-project issue types, fields and create-form layouts, scheme overrides with diff and reset, labels, versions, components |
| B. Issues | `modules/work/server/src/services/{issues,comments,history,links,search}` | Issue create, read, update, soft delete; gap-free numbering under the counter lock; history rows on every field change; comments with threads and reactions; links; watchers; work logs; `search_vector` keyword search and key prefix search for ⌘K; realtime invalidation; notifications through the kernel inbox and outbox |
| C. Workflow | `modules/work/server/src/services/workflow` | Statuses, transitions, the rules registry (`rules/` with one file per condition, validator and post-action), draft and publish with versions, the transition service that the issue service calls, validation of a draft before publish |
| D. Boards, sprints and filters | `modules/work/server/src/services/{boards,sprints,backlog,filters,metrics}` and `modules/work/server/src/services/lql` | Board config (columns, WIP, lanes, card layout, colour rules), lexorank ranking and the rebalance job, sprint lifecycle with the completion snapshot, velocity, burndown, cycle time and throughput, saved filters, LQL compiled to parameterised SQL |
| E. Board screen | `modules/work/web/src/{board,hooks/board*}` | Scrum and Kanban board matching the Board mock: columns, cards, drag and drop, swimlanes, quick filters, metrics strip, slide-over issue detail, live updates |
| F. Backlog screen | `modules/work/web/src/{backlog,hooks/backlog*}` | Backlog matching the mock: sprint containers, drag between sprints and backlog, epic panel, capacity bar, start and close sprint |
| G. Issue page and create form | `modules/work/web/src/{issue,create,hooks/issue*}` | Issue page matching the mock with every tab; the create form laid out from the type's layout; Home "my work" lists through the kernel's home extension point |
| H. Board settings and workflow editor | `modules/work/web/src/{settings,workflow,hooks/settings*}` | Board settings matching the mock: schemes with overrides and diff, columns, lanes, card layout, colour rules, method, cadence, estimation; issue types and fields; the visual workflow editor with transitions, rules and publish |

Shared web pieces (`modules/work/web/src/{api,shared,routes}`: the generated client calls, query
keys, Zustand stores and the chunk's router) are written by stream E first and extended by the
others through pull requests to the shared folder, never edited in place by two streams.

Rules for the streams: match the mocks pixel for pixel and verify in a running browser; follow
`AGENTS.md`; no file over 300 lines; no cross-stream edits (change `modules/work/shared` or a
kernel contract and say so in the PR instead); every schema change is a changeset; every PR
green before merge; commit every small win on its own.

### Integration

After the streams land: run the Playwright flows (create project, create issue, move it across
the board, plan a sprint, publish a workflow), measure the board p95 against the budget, verify
each screen beside its mock in a browser, enable and disable the module twice, then tag
`v0.2.0`.

## Decisions taken for 0.2.0

- Issue description and comment bodies are stored as ProseMirror JSON from the start, with a
  plain-text shadow column, so the Docs editor in 0.3 reuses the schema.
- Lexorank is implemented in `modules/work/shared` so the client can compute a provisional rank
  for optimistic drops; the server is the authority.
- LQL parsing lives in `packages/shared` and compiling in the module, as section 16 says, so the
  Docs module can embed issue tables without importing Work.
- Automation tables ship in this release's changelog so 0.5 adds no schema; the engine waits.
