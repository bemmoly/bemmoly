# Settings › Work: the org defaults

The issue types, fields, workflow and board every project inherits until it overrides them
(ADR 0030). Workspace admins only. The shell owns the frame and the settings sidebar; Work's
`settings.tsx` owns the header tabs and the pages, which are the project settings pages in the
org scope.

## Where it lives

- **Sidebar.** Settings › Modules › **Work** (the module tile), above Manage modules and Import.
  Shown to workspace admins; others never see the row. Manage modules still turns Work on and off.
- **Trail.** Settings / Modules / Work, then the header tabs: Issue types, Fields, Workflow,
  Board, in the order of a project's settings tabs (Members is a project's own, so it is not here).
- **From a project.** A project's Issue types, Fields and Board pages say "Based on Workspace
  board, with no changes yet for this project. Compare · Edit org default". Edit org default is a
  link, for workspace admins only, to the matching tab here.

## Primary job

Change what every project starts from, knowing which projects the change reaches.

## Top three actions

1. **Change the default board** (Board › any section › Edit, change, Review and save, Save
   changes). Mouse: the section's Edit. Keyboard: Tab to Edit, Enter; Tab through the fields;
   Review and save, then Save changes in the dialog (Mod+Enter submits it). Touch: the same
   targets, 44px.
2. **Rename or add an issue type or field** (click the name, or Tab to it and Enter; Add issue
   type). Enter or blur saves, Esc puts it back; the name changes at once and rolls back with a
   toast on refusal.
3. **Edit the default workflow** (Workflow › the Default row, Enter). The editor is the project
   editor: Undo (Mod+Z), Validate, Add status, Review and publish; publishing names the projects
   that run it.

## Who it reaches

One line under each page's title, on the accent wash where a project's page says what it is
based on, so the two read as a pair:

- "Used by 12 projects; 2 have their own version (PLT, OPS) and keep them. Changes here reach the
  other 10." Keys are listed up to three, counted beyond that.
- "Used by 4 projects. None has its own version, so changes here reach all of them."
- "No projects yet. New projects start from this default."
- The board's save review says it too: "These settings change on every project that follows the
  default when you save. Projects with their own board keep it."

A project has its own version of issue types or fields once it overrode them, of the workflow
once it holds a copy, of the board once it overrode it or changed any board setting. Archived
projects are left out of the counts.

## Keyboard

Nothing new. Esc goes back to the app outside a field, dialog or menu (the settings frame's);
the header tabs are links in Tab order; inside the board sections, the project page's keys
(arrow keys on a focused grip to reorder, Esc to leave a field). The workflow editor keeps its
own (Mod+Z, Delete). Checked against the global map: no single letters are added.

## States

- **Loading.** The trail and tabs paint at once; the page shows the skeleton of its final
  layout (the settings table, the board settings skeleton with the preview rail, the workflow
  editor skeleton). The usage line keeps its height with a skeleton bar.
- **Empty.** Never empty: the defaults are seeded, the default board too ("Workspace board",
  from the default workflow; remade on its next read should it ever be deleted). No projects: the usage line says new
  projects start here.
- **Error.** A page that fails says so in the frame with Try again; the usage line alone failing
  says "Couldn't count the projects using this default. Try again". A refused save keeps the
  draft and shows the server's reason under the section, as in a project.
- **Partial.** Counts load after the page; the page edits without them.
- **Many items.** Hundreds of projects: the usage line counts rather than lists. Saving the
  board then updates every following board in one transaction, so the button shows progress
  for longer.
- **No permission.** The row is hidden; opening the address shows "Only workspace admins can
  change Work settings" in the frame. Every write is refused on the server (403) for anyone but
  a workspace admin, including a Project admin workspace role.
- **Phone.** Header tabs move under the header and scroll sideways; the board's sections
  segmented control scrolls sideways; the preview rail hides below 1024px; tables keep name
  and the edit target.

## URL state

`/settings/work` (Issue types), `/settings/work/<issue-types|fields|workflow|board>`,
`/settings/work/workflow/<id>` for the editor. The board's section is `?tab=` as in a project.

## Choices recorded

- **Pages are shared, not copied.** Every page takes a `scope` (org or project). On the org
  scope there is nothing to override or reset, so those buttons, the Compare diff and the
  "Based on" note give way to the usage line.
- **Method.** Scrum or Kanban is each project's; the org Board page's last section is "Sprints
  and estimation" (sprint length, working days, estimation unit) without the method choice.
- **The preview rail** has no "Open board" on the org page: the default has no issues of its own.
- **Column counts** are hidden on the org board: a status's issues belong to many projects, some
  of which run their own columns.
- **Reset to default** on a project's board now drops the project's override mark too, so later
  changes to the default reach it again; before, it copied the default once and the project
  stayed overridden.

## Permissions tab

Settings › Work › **Permissions** (`/settings/work/permissions`), after Board: which role may
take which Work action, such as only a Scrum Master creating, starting and completing sprints.
The cells are the workspace roles matrix's own Work rows (Settings › Roles shows the same), drawn
as that matrix draws them: a column per role, custom roles in accent with "custom" under the
name, Org admin fixed and dimmed, rows grouped by area (Projects, Issues, Sprints, Boards,
Workflows and automation). Inside a project, the person's project role decides.

- **Primary job.** Grant or deny one action for one role, and save.
- **Top three actions.** (1) Toggle a cell (click, or Tab to the checkbox and Space). (2) Save,
  in the header, enabled once something changed. (3) Discard, which puts every cell back.
- **Keyboard.** Nothing new: Tab moves through the cells in reading order, Space toggles.
- **States.** Loading shows row skeletons; an error shows "Permissions did not load" with Try
  again; a refused save keeps the draft and toasts the server's reason. Never empty: the
  catalog always has rows. No permission: the page sits behind Settings › Work, which only
  workspace admins reach; the server refuses the read and every save to anyone else.
- **Phone.** The card scrolls sideways inside itself; the page does not.
- **Elsewhere.** Controls follow the same cells per project: Create sprint, Start and Complete
  sprint, the epics panel's create, Delete issue in issue menus, Review and publish in the
  workflow editor, and New rule in automation hide or disable for a role without the action.
