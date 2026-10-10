# Integration: one product from parallel streams

The screens were rebuilt in parallel. This file records the choices made when they were brought
together, where two streams drew the same idea two ways or a screen fell short of the principles.

## One component per idea

- **Tooltips.** Every icon button draws the shared Tooltip itself, with its shortcut (`keys`) and,
  where the accessible name is long ("Assign PLT-4 to me"), shorter words (`tip`). No native
  `title`, so no slow second tip. The tooltip wrapper is `display: contents` (it never moves a
  control's layout), the tip opens in the top layer like menus (a tip inside a dialog is neither
  clipped nor placed against the dialog's transform, and never changes the dialog's scroll size),
  and it opens at once only for keyboard focus: a click, or a dialog focusing its first control,
  does not open it. Pressing the control closes it.
- **Epic colour.** One helper, `epicColor` in `packages/ui`, reads the colour stored on the epic.
  The issue rail, the peek header and the create form used their own rules (by id, by position);
  they now read the stored colour, which issue lists carry (`color` on an issue is the epic's
  palette name, null otherwise).
- **Tiles.** A project's tile is `ProjectTile` everywhere (sidebar, switcher, projects table and
  grid, create form, create-project preview): its name's initial on its name's hue. The projects
  list no longer borrows the team's colour. Spaces in the sidebar use `EntityTile` with one letter;
  space tones map onto the entity palette (rose, rust, teal, violet, and the ink for slate), never
  the signal red or amber. The Docs pages keep their two-letter space tile (Docs is not redesigned)
  in the same colours.
- **Status.** A status is its glyph and its name, in sentence case. A glyph beside its own name is
  decorative, so assistive tech reads the name once (Settings › Modules read "To do Disabled").
  The linked-issue row other modules draw (Inbox detail, Docs) follows the list rows.
- **Words.** Capitals are gone from status badges, rule chips, diff marks, menu and select group
  labels (now the sidebar section style: 11px semibold, muted), the role matrix and the AI
  provider groups. Segmented counts read "All · 8" everywhere. The Backlog's sprint action says
  "Complete sprint", as the Board's does. Hints say "the arrow keys" and "the palette" in words.

## Layout

- **Project settings** share one reading column: Members, Issue types, Fields and the Workflow
  list are `contained`, as every settings page is. Board settings (five columns and a preview
  rail) and the workflow editor (a canvas) stay `full`, as editors.
- **Description.** The description has no heading, so its pencil floats on the text's top corner
  (on hover and focus, always on touch) instead of a row of its own above the first line; while
  typing, the save state sits in the editor's footer.
- **Phones.** The Backlog row lets the epic step aside so the title keeps its room; the sprint
  header keeps its name and drops dates, chip and bar; Board lanes keep the epic's name and drop
  the key and bar; card keys never wrap.

## Behaviour added

- **Board selection and Display** (see `board-backlog.md`): the Board selects like the Backlog,
  with one shared bulk bar; Display choices are personal, per board, in this browser.
- **Optimistic quick edits** (see `board-backlog.md`): assign, priority and sprint moves show at
  once on every cached board, backlog and issue, roll back per issue on refusal, and offer Undo.
- **Presence** (see `shell.md`): a facepile in the Board, Backlog and Issue headers. Realtime
  subscriptions, and so presence, are limited to the people who can open the project or space;
  before this anyone signed in could subscribe to any project's invalidations.
- **Link issue** is in the shared issue menu, opening the keyboard-first link dialog, so linking is
  reachable from a card or row without opening the issue.
- **My issues** walks with j and k from anywhere on Home or the My issues page; the arrows follow
  once a row has focus (never stolen from the page's scroll or another control).
- **Create over the board.** C on a Scrum board starts the issue in the running sprint, as a
  column's create does; elsewhere it starts in the backlog.
- **No access.** An issue in a project the person is not a member of says so and who can add them
  (no Try again); a missing issue says it is gone; only a failure offers Try again.
- **Boot frame.** It paints in the look this device last showed (see `shell.md`).

## Tokens

The first release's aliases (`COLOR_ALIASES`, `TYPE_ALIASES`, `RADIUS_ALIASES` and the old
`shadow-*` names) are removed. Every call site names the canonical token. Values on screen did not
change, checked by comparing screenshots of every screen before and after, with two intended
exceptions: the old card and segment shadows were a drop under an element's own border, so a
segmented control's selected option now takes `e1` with its ring (as the review draws it), and an
element that kept its own border lost the extra drop.

## Left for later

- The Appearance page's live preview still draws the first release's board (crumb, "Sprint 24",
  plain column names); it should mirror the new Board.
- A custom logo on sign-in waits for logo upload, which is not built; sign-in shows the workspace
  initial until then.
- The Inbox has no Approve or Request changes, since there is no review action yet.
- The bulk bar scrolls sideways at 390px; an icon-only phone bar would fit.
- Menu rows are about 33px on touch, under the 44px target.
- Presence is per server process; an install running several processes shows only the people on
  the same one. The peek counts you as on the board, not on the issue.
- Create over the Board starts in the workflow's first status, not the column's.
