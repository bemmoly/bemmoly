# Board and Backlog

Two views of the same issues: one IssueCard, one IssueRow (same fields, same order), one filter
bar, one issue menu, one peek.

## Shared

- **Filters live in the address**: `q`, `assignee`, `epic`, `type`, `label`, `quick`, `lql`,
  `view`, and `group` on the Board. A filtered link reproduces the view; a reload keeps it.
- **Filters hide, never fade.** Cards and rows that do not match leave the screen and every count
  (column, lane, sprint) is the shown issues. A filtered empty board says so and offers
  "Clear filters".
- **/** focuses search; Esc in search clears it. Set filters are chips with a remove button;
  Clear appears from two filters.
- **Peek**: one click (or Enter) opens the issue beside the list at `?issue=KEY`. Back closes it,
  Forward reopens it, reload restores it. ↑↓ / j k step through issues in screen order; the
  panel header has the same arrows with tooltips. Closing returns focus to the card or row.
  The list order is also remembered for the Issue page (`useRememberIssueList`).
- **Issue menu** (··· on hover and focus, and right-click on the card or row): Open, Open full
  page, Copy link, Assign to me / Unassign (I), Priority, Move to (backlog only), Delete.
  Applied to a selection when the issue is part of one.
- **Delete is undoable**: the issue leaves at once, a toast offers Undo for 6 seconds, and the
  delete is sent only after that. No confirmation dialog.
- **States**: skeletons match the strip, filter row, column headings, lanes and rows; load errors
  say what happened with Try again; a stale backlog says it may be out of date.

## Board

- Primary job: see and move the sprint's work. Top actions: move a card, open it, create in a
  column.
- Sprint strip: target icon, sprint name, "Ends today" chip (amber when one day or less), dates
  and goal, "9 of 48 points done" over the two-tone bar (done green, in progress blue).
  "Complete sprint" opens the real dialog (over the backlog, `?complete=<sprint>`), since the
  dialog needs the backlog's containers.
- Column headers: status glyph from the column's first status, sentence-case name, count, WIP
  chip (amber once reached), + and ··· on hover and focus. + opens the column's create field in
  the first open lane.
- Create in place: "New issue" at the foot of every cell (on hover, always on touch). Enter
  creates in this column, lane (epic or assignee) and the running sprint and keeps the field
  open; Esc or an empty blur closes.
- Card hover tools: Assign to me (I), Open in peek (Enter), ···. Delete or Backspace on a focused
  card deletes with Undo.
- Lanes take the epic's stored colour; the "by epic" stripe uses the card's own epic colour.
- Drag: lifted card, accent drop line, amber dashed cell with the workflow's reason when refused.
- Phone: one column at a time, chosen from status segments under the filter row.
- Not yet: multi-select on the Board (selection lives on the Backlog); Display menu.

## Backlog

- Primary job: plan sprints. Top actions: drag into a sprint, open, bulk edit.
- Rows: grip on hover, selection box on hover and focus (always visible while selecting), type,
  key, title with a red lock when blocked, epic in its stored colour, status glyph, priority,
  points, avatar. 36px.
- Selection: box click toggles one; Shift-click extends from the anchor; ⌘/Ctrl-click toggles.
  A plain click opens the peek (no more double-click). Esc clears the selection.
- Bulk bar rises from the bottom: Assign to me, Priority, Move to (sprints and Backlog), Delete
  with Undo, Esc.
- Sprint header: chevron, target (accent when active) or backlog icon, name, Active / Planned
  chip, dates · issue count · goal, then the two-tone bar and "9 / 48 pts" for the active sprint
  or capacity for planned ones, and one action (Complete / Start sprint).
- Epics rail: 190px on the sunken surface, stored colours, percentage and a thin bar; picking one
  sets the Epic filter (and picking again clears it). Toggled by "Epics" in the filter row;
  hidden on phones.
- Decision: the review offers Group Sprint / Epic / None on the Backlog. The Backlog stays grouped
  by sprint, because planning is moving work between sprints and the other groupings would break
  drag into a sprint; the Board offers the grouping switch instead.
