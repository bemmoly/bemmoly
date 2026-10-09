# @bemmoly/module-work

## 0.2.0

### Minor Changes

- d313831: The Work module ships in the image, off until an admin enables it in Settings › Modules.
  Enabling it runs its schema changelog, which creates the issue tracking tables (projects,
  issue types and fields, workflows, issues, links, labels, versions, components, sprints,
  boards, saved filters, comments, history, work logs, watchers, attachments and automation
  rules) and adds the pg_trgm extension for prefix search, which needs the database owner or a
  superuser to have created it on managed databases that do not allow trusted extensions. Once
  enabled, "Board" and "Backlog" appear in the top navigation as placeholders and the Work
  capabilities (create and configure projects; view, create, edit, move and delete issues;
  manage sprints; configure the board) appear in the roles matrix with their defaults. The
  screens and the API behind them arrive in later changes of this release. No configuration
  change.
- 7d09c70: Projects now have members you can manage. Open Members from a project's row menu in the
  project list, or from the project switcher, to see who can open the project and the role each
  person holds in it. Project admins add people (found by name or email) or whole teams, change
  a role in place, and remove someone after reading back what they lose. A project always keeps
  one project admin. Whoever creates a project becomes its project admin, and everyone in the
  owning team joins with the team's default role. People see only the projects they belong to in
  the project list; org admins still see every project. Access to a project's issues, search,
  boards and Home follows membership on the next request, and LQL issue queries, which failed
  for everyone, now work and respect it too. Every change is in the audit log. The API is
  `GET` and `POST /api/v1/work/projects/:key/members`, and `PATCH` and `DELETE
/api/v1/work/projects/:key/members/:userId`. No configuration or schema change.
- 7d09c70: The workflow editor shows how many issues sit in each status, counting only projects that use
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

### Patch Changes

- e2aa5d2: Home now shows sections from the modules you can open, above "Your modules". A module adds one
  by shipping `web/src/home.tsx`; a section that fails to load shows a retry card and leaves the
  rest of Home working. Work adds "My work": the issues assigned to you, reported by you and
  watched by you, each tab with its count, served by `GET /api/v1/work/my-issues`. No
  configuration or schema change.
- e2aa5d2: The command palette (⌘K) now searches inside modules. The kernel serves `GET /api/v1/search`
  from search providers that modules register with `ctx.search.addProvider`; it asks only the
  modules a person can open, and each provider keeps to what that person may see. Work answers
  with issues by key (type `PLT-14`) and by keyword, each with its status and assignee, under an
  "Issues" group and scope. No configuration or schema change.
- c646c34: Work gains the Backlog screen at /work/backlog. Each open sprint shows its dates, goal, status
  counts and points, with planned sprints measured against their capacity, above the backlog of
  unplanned issues. Issues can be dragged within and between sprints and the backlog, alone or
  several at once after a shift or cmd selection, and moved from the keyboard: space picks a row
  up, the arrow keys move it and space drops it. The order changes on screen at once and the
  server confirms it. The epics panel shows each open epic's progress and filters the list, as do
  the search box and the type and assignee filters. Issues and epics can be created in place,
  sprints can be created, edited, deleted before they start, started with their dates and goal,
  and completed, choosing where unfinished issues go. The screen updates live when someone else
  changes the plan, and stays smooth with a thousand issues in the backlog. No schema or
  configuration change.
- 66e9507: The board's ··· button now opens a menu: Board settings, Workflow, and Copy board link, which
  puts the board's address on the clipboard. On windows narrower than 1200px, an issue opened
  from the board slides over the board behind a dimmed backdrop instead of squeezing it; Escape
  or a click on the backdrop closes it and returns you to the card. Wider windows keep the panel
  beside the board as before. No configuration or schema change.
- 83c390e: The Work board is now a working screen instead of a placeholder. A project's board shows its
  columns mapped to statuses with counts and WIP limits, swimlanes, and cards laid out with the
  board's card fields and colour rule; Scrum boards show the active sprint with its dates, goal
  and velocity, Kanban boards show work in flight, cycle time and a throughput trend. Cards move
  by drag and drop or from the keyboard (space picks a card up, the arrows carry it, space drops
  it, Escape puts it back). A move into another column goes through the workflow, and a column
  the workflow does not allow says why before the card is dropped; a move within a column
  reorders it at once while the server confirms. The filter row adds people, epic, type and label
  filters, quick filters, grouping, and an LQL bar that checks the query as it is typed and
  suggests fields, operators and values. Cards open in a panel beside the board, and the board
  updates live when someone else changes an issue. Long columns render in windows, so a 500-card
  board stays responsive. No configuration or schema change.
- cab0760: Projects gain a settings screen at Project settings › Board. It shows which org default the board
  inherits and how many settings the project has changed, with the full list a click away, and has
  tabs for columns mapped to workflow statuses (add, rename, drag to reorder, move statuses between
  columns, WIP limits), swimlanes including lanes written as queries, quick filters, the card
  fields and their order, card colours by priority, type, epic or a query, and Scrum or Kanban with
  sprint length, working days and the estimation unit. A live preview beside the tabs follows every
  edit. Each tab is read first and changed only after Edit; saving shows what changes, and a change
  that takes cards off the board, such as removing a column that holds issues or switching a Kanban
  board to Scrum, says so and asks first. Reset to org default shows the difference and asks for a
  typed word. People who may only edit WIP limits can change those and nothing else. Issue types and
  fields get their own settings pages to inherit, override or reset the org default. Queries are
  checked as they are typed and offer suggestions. Boards can now store colour rules; boards saved
  before keep working unchanged. No schema or configuration change.
- a28fa79: The board loads faster, most of all on large projects: a 500-card board reads its cards in less
  than half the time, and a board of nearly 5,000 cards about five times faster. When the
  workflow refuses a move, only that card goes back; other cards you dropped meanwhile stay where
  you put them. Screen readers now hear a move as pending at the drop, then that it went through
  or why it did not, instead of hearing it moved before the server had answered.

  Schema: one new index, `issues_project_updated_idx` on issues (project_id, updated_at), built
  concurrently by the Work changelog (`0022-work-issues-updated-index`), so an upgrade does not
  block writes while it builds. No configuration change.

- 80faa4d: Work gains the server side of boards, sprints, the backlog, saved filters and metrics. A project
  gets its board the first time it is opened, copied from the org default board scheme or built
  from its workflow, and the board can be configured with columns mapped to statuses, WIP limits,
  swimlanes by epic, assignee, priority, type or a query, quick filters, card fields and colour
  rules. The board view returns every card grouped by column and lane in one request, narrowed by
  an optional query. Scrum projects can plan, start and complete sprints, one active at a time;
  completing a sprint moves unfinished work to the backlog or another sprint and records what was
  committed and completed for the velocity report. The backlog lists sprints with their committed
  points beside capacity, and issues can be dragged between sprints and the backlog. Filters can be
  saved privately or shared with teams. Boards report velocity, the active sprint's burndown, cycle
  time and throughput. Board and sprint changes appear in the audit log. No schema or configuration
  change.
- 158db6a: Fixes found by the end-to-end Work flows. Page loads no longer count against the strict
  ten-a-minute limit for sign-in and setup, which locked everyone behind one office address out
  with "Too many requests". Mentioning someone in an issue description now notifies them, as a
  mention in a comment does. On the board, a card moved twice in a row is judged by the
  transitions of its current status, a card dropped with the keyboard keeps the focus, a card
  dropped on a column's refusal note says why it stays, quick moves no longer jump back while
  the server catches up, and a link to a project you cannot see says so instead of inviting you
  to create one. Realtime updates refetch only what changed, and an issue's activity now reads
  "created the issue" rather than "changed created". No configuration or schema change.
- e2aa5d2: Fixes found by the new Work integration tests:

  - Issues created at the same time in one project get distinct board ranks.
  - `?deleted=false` and `?archived=false` mean false; before, any value listed the trash or
    included archived projects.
  - A transition whose validator asks for a field (an estimate, say) accepts that field in the
    same request that moves the issue.
  - Moving an issue answers with what the transition's post-actions changed, and open boards and
    issue pages refresh to show it.
  - Post-actions and workflow publishes record history with the same field names as every other
    change, so one issue's history reads as one list.
  - Notifications reach only people who can open the issue's project; a mention or an old watch
    no longer sends the issue's title and comment to someone outside it.
  - An issue can only carry labels, a fix version and a component of its own project.
  - Typing a full issue key suggests that issue before keys that extend it.

- 72bd7b9: Work gains its Issue page, the same issue in a slide-over for the board, the create issue form
  and the project list. The Issue page shows the title, the status with the transitions the
  workflow allows, description and rich text fields such as acceptance criteria, subtasks, linked
  issues, and activity with threaded comments, reactions, history and the work log; every field in
  Details edits in place, and the AI summary shows its empty state until AI is turned on. The
  create form lays itself out from the issue type's form layout, checks its required fields and
  names the new issue's key when it is created. Projects lists every project you can see and
  creates new ones with a key, Scrum or Kanban and an owning team. The top bar's Create menu now
  offers Issue and Project, and Projects joins Board and Backlog in the top bar. The select gains
  a ghost look for values edited in place. No schema or configuration change.
- e2aa5d2: Work projects now have labels, versions and components you can list, create, rename and delete
  under `/api/v1/work/projects/:key/labels`, `/versions` and `/components`. The lists come back in
  name order and take a name prefix (`?q=`), so the create form and the issue page can offer them
  as you type. A version has a planned release date and a status; marking it released records
  when, and moving it back to unreleased clears that. A component can name an active person as
  its lead. Anyone who can edit issues can add a label; everything else needs project
  configuration. Each change is written to the audit log. No configuration or schema change.
- b4f5ea9: Issue descriptions, acceptance criteria and other document fields, and comments, are now written
  in a rich text editor instead of a plain text box. The tools are bold, italic, mention, link and
  code, with headings, bulleted and numbered lists, checklists, quotes and code blocks for
  descriptions; the usual shortcuts work (⌘B, ⌘I, ⌘E, ⌘K for a link, ⌘↵ to save or post, Escape
  to cancel), and typing / offers the blocks. Type @ to mention someone, or # to link an issue by
  key or title; issue keys you type or paste become links on their own, and pasted web addresses
  do too. Text reads the same after saving as it did while you wrote it. The editor loads the
  first time you edit, so pages that only show text stay as fast as before. Existing descriptions
  and comments open unchanged. No schema or configuration change.
- 9c7de90: The Board can save its LQL filter. With a query applied, "Save filter" names it and says who
  sees it: only you, or one of your teams. A Saved filters menu beside the filter bar lists your
  own filters and those shared with your teams, and applies one in a click; your own can be
  renamed or deleted there, with a confirmation before a delete. No configuration or schema
  change.
- 4d5e58f: The Work screens feel finished. Dialogs, the issue slide-over, menus, dropdowns and toasts now
  open and close with short, calm motion, and nothing moves for people who ask their system for
  reduced motion. A board card lifts when you pick it up and settles where you drop it. Every
  Work screen (board, backlog, issue page and slide-over, projects, members, board settings,
  workflows and Home's "my work") loads into a placeholder shaped like the finished page instead
  of grey blocks, so nothing jumps when the data arrives. Empty boards, sprints, backlogs, saved
  filters, workflow lists and member lists say what they are and offer the one thing to do next.
  The create issue form opens with the cursor in Title, the workflow pages use the same project
  settings sidebar as the rest of project settings, buttons show a pressed state, long names
  show in full on hover, counts line up, and scrollbars inside white panels no longer draw a grey
  ring. No configuration or schema change.
- 7625bb6: Unsaved work in Work settings is no longer lost when leaving through the top bar, Back or a
  typed address. Board settings with an unsaved draft shows its unsaved-changes bar and waits for
  Keep editing or Discard and leave; the dialogs that add an issue type or a custom field ask
  before dropping a name that was typed; the workflow editor finishes saving the draft before it
  leaves, and asks only when that save fails. Modules get the same guard the workspace settings
  pages use, so any module page can hold a move away from unsaved work. No configuration or
  schema change.
- 5935186: Edit workflows visually. Work settings › Workflows lists the org default workflow and the
  project's own copy with the published version, the projects using each and when it last
  changed, and opens the workflow editor: drag statuses to arrange them, drag from a status's
  handle to another to add a transition, and pick conditions, validators and post-actions from the
  rules registry with their settings in the side panel. Changes save to a draft as you work.
  Validate lists the draft's problems and marks the status or transition each one concerns;
  Publish says which version it makes and which projects move to it, and asks where the issues of
  a removed status should go. Everything on the canvas is reachable from the keyboard: Tab between
  statuses and transitions, arrow keys to move a status, Delete to remove one after confirming.
  No configuration or schema change.
- Updated dependencies [dcbcae4]
- Updated dependencies [7d09c70]
- Updated dependencies [e2aa5d2]
- Updated dependencies [51cd3ae]
- Updated dependencies [e2aa5d2]
- Updated dependencies [2e14b26]
- Updated dependencies [158db6a]
- Updated dependencies [72bd7b9]
- Updated dependencies [d313831]
- Updated dependencies [b4f5ea9]
- Updated dependencies [4d5e58f]
- Updated dependencies [7625bb6]
  - @bemmoly/core@0.2.0
  - @bemmoly/core-web@0.2.0
  - @bemmoly/shared@0.2.0
  - @bemmoly/ui@0.2.0
  - @bemmoly/editor@0.2.0
  - @bemmoly/api-client@0.2.0
