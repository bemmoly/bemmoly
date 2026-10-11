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
  page, Copy link, Assign to me / Unassign (I), Priority, Move to (the Backlog, and the Board
  when the project is Scrum), Delete. Applied to a selection when the issue is part of one.
- **Selection** works the same on both: the box toggles one, Shift-click extends from the
  anchor in screen order, Cmd / Ctrl-click toggles one, a plain click opens the peek and moves
  the anchor. The one bulk bar (`shared/issue-bulk-bar.tsx`) rises from the bottom with the
  count, Assign to me, Priority, Move to (only where there is somewhere to move), Delete with
  Undo, and Esc. Esc clears the selection unless a menu, a field or a drag has the key. Filters
  that hide a selected issue drop it; acting keeps the selection, deleting clears it.
- **Delete is undoable**: the issue leaves at once, a toast offers Undo for 6 seconds, and the
  delete is sent only after that. No confirmation dialog.
- **Optimistic edits**: assign, priority and Move to (card tools, the issue menu, the bulk bar,
  `I`) show in the same frame on every cached Board, Backlog and open peek: a card moved to
  another sprint leaves a sprint board, a row changes container and the sprint totals follow.
  While the edit is on its way the card or row dims to 60% after a 160ms beat, so a quick answer
  shows nothing. An issue the server refuses goes back alone (the others keep their edit) with
  the usual "could not be changed" toast, which replaces the success toast. Edits to one issue are
  sent in order; Work reads refresh once the last edit in flight settles. "Moved to …" and
  "Assigned N to you" offer Undo for 6 seconds, putting each issue back where it came from.
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
- Card hover tools: Assign to me (I), Open in peek (Enter), ···; they also show while the card
  has keyboard focus. Delete or Backspace on a focused card deletes with Undo (the whole
  selection when the card is part of one; I assigns it the same way).
- Lanes take the epic's stored colour; the "by epic" stripe uses the card's own epic colour.
- Drag: lifted card, accent drop line, amber dashed cell with the workflow's reason when refused.
- Phone: one column at a time, chosen from status segments under the filter row.

### Selecting cards

- Job: change several cards at once without opening them (assign the sweep of a standup,
  reprioritise a column, push leftovers to the next sprint).
- The mark: a round check on the card's top-left corner, on hover and keyboard focus, always
  shown while anything is selected and always on touch. Round and on the corner, not a square
  over the type tile: a ticked square read as the task glyph, and the type stays visible while
  selecting. Its hit area is 34px (46px on touch). A selected card takes the accent tint.
- Range order is the board as drawn: lane by lane, and inside a lane column by column, top
  down (the same order j / k and the peek arrows step). Folded lanes are skipped.
- Keys on a focused card: x toggles it, Shift+x extends the range to it, Esc clears, I and
  Delete act on the selection the card belongs to. Space still picks the card up.
- Move to on the Board lists the planned sprints and the Backlog, never the running sprint
  every card is already in; Kanban boards have no Move to.
- Drag: a selected card drags alone and stays selected; the selection never blocks a drop.
- The selection is kept per board: leaving and coming back finds it; another board starts empty.
- States: none selected shows nothing extra; one or more shows the bar; a card deleted inside
  its Undo window leaves the selection.

### Display

- Job: make the board read the way this person works: fewer fields on a busy board, denser
  cards on a small screen, no room spent on empty columns.
- The Display button sits at the end of the filter row, with a tooltip ("Card fields, density
  and empty columns") and an accent dot while the view differs from the board's own.
- Card fields: Key, Priority, Points (Scrum) or Time in column (Kanban), Assignee, Labels,
  Blocked by, Linked doc, Subtasks. The type tile and the title always show. Each is a
  checkbox item; the menu stays open so several changes are one visit.
- Density: Comfortable (today's card) or Compact (tighter padding and gaps, the title kept to
  two lines, cards 6px apart). A compact card is still over 44px tall.
- Show empty columns: off, columns with no card after filters step aside. They come back while
  a card is carried, so it can still be dropped there, and when every column is empty.
- Reset to the board's default appears once anything changed.
- Decision: these are personal, per person and per board, kept in this browser (client state),
  not in the board's settings, which the whole project shares and admins own. Untouched, the
  board looks exactly as its settings draw it; a field set back to the board's own choice
  follows the board again, so an admin's later change still reaches it. Storage that is
  blocked, full or unreadable falls back to the board's look; nothing breaks.
- Not offered: epic and due date on the card, because the card has no place for them yet (the
  epic shows as the lane and the stripe).

## Backlog

- Primary job: plan sprints. Top actions: drag into a sprint, open, bulk edit.
- Rows: grip on hover, selection box on hover and focus (always visible while selecting), type,
  key, title with a red lock when blocked, epic in its stored colour, status glyph, priority,
  points, avatar. 36px.
- Selection and the bulk bar as under Shared; a plain click opens the peek (no more
  double-click), and Shift with the arrows extends from the focused row. Move to lists every
  open sprint and the Backlog. A selected row drags the whole selection.
- Sprint header: chevron, target (accent when active) or backlog icon, name, Active / Planned
  chip, dates · issue count · goal, then the two-tone bar and "9 / 48 pts" for the active sprint
  or capacity for planned ones, and one action (Complete / Start sprint).
- Epics rail: 190px on the sunken surface, stored colours, percentage and a thin bar; picking one
  sets the Epic filter (and picking again clears it). Toggled by "Epics" in the filter row;
  hidden on phones.
- Decision: the review offers Group Sprint / Epic / None on the Backlog. The Backlog stays grouped
  by sprint, because planning is moving work between sprints and the other groupings would break
  drag into a sprint; the Board offers the grouping switch instead.
