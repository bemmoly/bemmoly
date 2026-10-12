# Pairing

**Primary job.** See who has worked beside whom on a project, so pairing spreads knowledge
instead of settling into the same few pairs.

**Where it lives.** A fourth view of a project beside Board, Backlog and Roadmap
(`/work/pairing/PLT`, header tab Pairing, `G P`), in the `full` layout: a toolbar with the date
range, then the matrix, then the pair panel under it.

**What is on it.** A square table, one row and one column per person who held an issue in the
range, most issues first. A cell is the number of issues the two shared while both were
assigned; its tint deepens with the count (four steps of the accent, empty for never). The
diagonal is blank. Choosing a cell opens the pair panel: their issues together (most recent
first, each opening in the peek), the hours together and the last day they paired.

**Suggested pairs.** While an admin has `work.pairing.suggestions` on (off by default, set
through the admin settings API), a row of suggestions sits above the matrix: each person at
most once, people who never paired first, then the pairs that shared fewest issues and paired
longest ago. An odd person out is left unpaired. Each suggestion opens its pair panel. With the
setting off the row is not drawn and the server sends none.

**Top three actions.**

| Action             | Mouse                       | Keyboard                              | Touch           |
| ------------------ | --------------------------- | ------------------------------------- | --------------- |
| Read a pair        | Click the cell              | Arrows to the cell, Enter             | Tap the cell    |
| Change the range   | The range control in the toolbar | Tab to it, then ← →              | Tap a segment   |
| Open a shared issue | Click it in the pair panel | Tab to it, Enter                      | Tap it          |

**Keyboard map.** Checked against the global map: `G P` was free. No single key here is global,
and none fires while typing or in a menu.

| Keys          | Does                                                   |
| ------------- | ------------------------------------------------------ |
| ← → ↑ ↓       | Move between cells (a roving tab stop, one per table)  |
| Enter, Space  | Open the focused cell's pair panel                     |
| Escape        | Close the pair panel, focus back on its cell           |

**States.**

- Loading: the table's skeleton, rows of grey cells.
- Empty: nobody held an issue in the range: an EmptyState that says so and offers the last year.
- Nobody paired: the people show, every cell empty, and a line under the table says no two
  people were assigned to an issue at the same time in the range.
- Error: the page status with Retry.
- Many people: past 30 the table scrolls both ways inside the pane, names sticky on both axes.
- No permission: the project's own no-access state, as the other views.
- Phone: the table scrolls sideways; the pair panel follows under it.

**URL state.** `?range=30|90|365` (90 when absent) and `?pair=<a>,<b>` for the open panel.
Suggestions follow the range; they have no state of their own.

**Choices recorded.**

- The tint uses `acc-50`, `acc-100`, `acc-500` and `acc-fill` (with `on-acc` text on the last).
  The accent marks something you can act on, and every filled cell opens its pair, so it is
  the accent and not a new chart palette. The count is always printed, so colour never carries
  the meaning alone.
- A pair counts on every issue where two people's assignee stints overlap; three people on an
  issue at once are three pairs. Hours are the overlap clipped to the range.
- The people are those who held an issue in the range, not the project's members: someone
  who never held one has nothing to show and only widens the table.
- The range control is a SegmentedControl, not a menu: three fixed choices read better side
  by side.
- Suggestions are a flag in Work's settings with no settings page yet; one switch did not earn
  a screen of its own.
- Anyone who can view the project's issues can open it: it shows nothing an issue's history
  does not already show.
