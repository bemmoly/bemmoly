# @bemmoly/ui

## 0.2.2

No changes in this release.

## 0.2.1

No changes in this release.

## 0.2.0

### Minor Changes

- 2e14b26: The design system gains the pieces the Work screens are built from, each ported from the Board,
  Backlog, Issue, Board Settings and Workflow mocks with a Storybook story beside its mock crop:
  the board card with its blocked badge, labels, estimate or time in column and colour-rule
  stripe; column headings with WIP limits and the lane drop areas; collapsible swimlanes; quick
  filter chips; the velocity and flow tiles and the capacity bar; sprint containers with their
  headers and backlog rows; the epics panel; the Issue page's subtask, linked issue and acceptance
  criteria rows, activity entries with reactions, the comment box and the Details field list;
  create form layout pieces and the fields table; the workflow canvas with status nodes,
  transition arrows and labels, rule chips and status pills; and the "Inherits from" banner with
  its diff and reset actions. Issue types now include Epic, Incident and Subtask, priorities add
  Lowest, and the type tile comes in the 18px and 36px sizes the type settings use.

### Patch Changes

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

## 0.1.7

No changes in this release.

## 0.1.6

No changes in this release.

## 0.1.5

No changes in this release.

## 0.1.4

No changes in this release.

## 0.1.3

### Patch Changes

- 04c4f3a: Settings pages no longer let a stray click change something. Storage and backups, Updates, Email
  and notifications and Workspace details open showing your current values; each section has an
  Edit button, and Save stays off until you change something. Changes that can lose backups or
  stop people working (lowering retention, removing the backup bucket, turning off local
  encryption, switching the update channel, sending email to the dev mailbox) say what will happen
  before they are saved, and the riskiest ask you to type a word to confirm. If you leave a page or
  have two sections open with unsaved changes, a bar at the bottom says so.

  Restoring a backup is easier to find: every backup that can be restored has a Restore button, a
  Restore… button at the top of Storage and backups lets you pick one, and the confirmation explains
  maintenance mode, what is replaced and the fallback copy kept of your current data. The backups
  table scrolls sideways on narrow screens instead of cutting off its buttons.

  The top bar no longer shows arrows on links that do not open a menu. Create opens a clear menu of
  what you can make, or explains that it fills once a module is enabled, with a link to Settings ›
  Modules for admins. Icons across the app are clearer, including real Inbox and theme icons in the
  top bar, and dropdown arrows are larger and darken while open. The Team filter in Settings › Users
  can be searched, and abandoned people searches stop instead of finishing in the background.

## 0.1.2

### Patch Changes

- 3fb2621: Every dropdown is now the same control, whether it holds three options or three hundred. The
  arrow on each dropdown is darker so you can see it, the list opens in a popover that is never
  cut off by a table or a panel, and it works from the keyboard. Long lists show the first 50
  with a search box; people pickers (team lead, module access, the audit log's actor) search the
  whole workspace on the server as you type, and role and team pickers can be searched too. The
  "···" menu on a user row in Settings › Users now opens where you can see it.

## 0.1.1

### Patch Changes

- e231a13: The first-run setup reads in order. Step 1 asks for the workspace (name, then its address)
  and then for your account (name, email, password), one field per row, in two labelled groups.
  The address is filled in from the browser and shown as a value to check. On the People step
  the email invites have a proper heading that says new people join as Members with no team,
  and the Done summary leaves skipped steps unticked. The note beside the steps now only says
  that everything can be changed later in Workspace settings. No configuration or schema change.
- 94c57cc: The first-run setup wizard shows real logos on its option cards: each AI provider in the
  bundled catalog, the import sources and the single sign-on options, all drawn in the current
  text colour so they follow the theme. Importers and single sign-on are marked "Coming soon"
  instead of looking broken; on the import step "Start clean" is picked from the start, so
  Continue moves on without skipping. Settings › AI uses the same provider logos.

## 0.1.0

No changes in this release.
