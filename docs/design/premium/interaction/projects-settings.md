# Projects and project settings

Projects, Members, Issue types, Fields, Board settings and the Workflow list and editor. The
shell (header, breadcrumbs, settings tabs) belongs to the frame; these notes cover what sits
under it.

## Projects (`/work/projects`)

- **Job:** find a project and go to it. **Top actions:** open the board, star, New project.
- **Keys:** ↑↓ / j k move between rows, Enter opens the board, Esc clears the search.
- **Find:** search on name, key and description; All / Starred / Archived segments; list or
  grid toggle. Sort by any heading; search, segment, sort and layout live in the URL.
- **Row menu (··· or right-click):** Open board, Backlog, Settings, Members, Star, Archive.
  Archive happens at once with Undo; archived projects show faded under Archived.
- **States:** skeleton rows of the final height; empty with New project (C); no matches with
  Clear search; error with Retry. The grid becomes one column on phones and the layout toggle
  hides there.

## Members

- **Job:** see who can open the project and change their role.
- Search plus All / Admins / Invited segments (counts in the segment). Role is a quiet ghost
  button that opens a menu with the current role checked; it is plain text without "Configure
  project" or for the last project admin (with a tooltip saying why). "You", "Invited" and
  "Deactivated" are sentence-case marks. Remove stays behind a read-back, since access ends at
  once and cannot be undone from here (re-adding is a new invite).
- **Phone:** Added hides; person and role keep their room.
- **Choice:** the review draws a Team column. Members carry no team today, so the column is
  left out rather than drawn as dashes (the review's own complaint about Projects).

## Issue types and Fields

- **Job:** see what the project tracks and adjust it once the scheme is the project's own.
- Inheritance is one line on the accent wash: "Based on Software, with 3 changes for this
  project · Compare" (Compare opens the diff). Unchanged schemes say so.
- Both are the one table style. Before overriding they read only, with a hint line saying
  what overriding unlocks.
- **Rename in place:** click a name (or Tab to it and Enter), Enter or blur saves, Esc puts
  it back. The new name shows at once; a failed save rolls back with a toast saying why.
- **Reorder (issue types):** drag the grip, or focus it and press ↑↓; the order moves at once
  and the drop line shows where a dragged row lands. Pickers follow this order.
- **Choice:** Fields have no order of their own; their order is per issue type, in its
  create-form layout, so the Fields table offers rename and not reorder.
- AI-filled fields carry a small lilac "AI fills" mark, the one colour kept for AI.

## Board settings

- **Job:** shape the board everyone on the project sees.
- One-line inheritance note, then the sections as a segmented control (an amber dot marks a
  section with unsaved changes), then the content.
- **Columns:** all five fit at 1440px (each at least 140px; more columns or a phone scroll
  sideways). Each column shows its first status's glyph, the name, a compact "WIP" field that
  reads "No limit" until set, and a green check on the column that resolves issues. Statuses
  sit on the sunken surface with their glyph and count; the dashed target says "Drop a
  status". In edit mode the glyph becomes the grip (drag or ←→). Statuses left out are listed
  inline as "Not on the board", with "Statuses come from the Workflow".
- **Preview rail:** "Live preview" on the sunken surface with Open board; hidden below 1024px.

## Workflow list

- One name everywhere: the tab and the page are "Workflow"; the list says "This project" or
  "Default" in plain words, a dot marks the workflow this project runs, and a draft shows a
  "Draft" mark. Rows open the editor (Enter too). Phones keep name and version.

## Workflow editor

- **Job:** change statuses and transitions in a draft, then publish knowingly.
- **Header:** "All workflows" back link, the name, where it applies, version and draft state
  (live region), then Undo (⌘Z), Validate, Add status and "Review and publish", which opens
  the diff dialog listing every change and who it affects before anything goes live.
- **Undo over confirm:** deleting a status or transition (button or Delete on the canvas)
  happens at once, with a toast naming what went (and the transitions it took) and Undo for
  about six seconds. Nothing is live until publish, so a confirmation would only slow people
  down. ⌘Z / Ctrl+Z walks back the last 50 edits, never while typing in a field.
- **Canvas:** nodes draw the status glyph (coloured by category only); the legend uses the
  same glyphs.
- **Phone:** the canvas and the panel stack, the panel capped at 45% of the height.
