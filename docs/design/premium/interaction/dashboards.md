# Dashboards and Quarter

## Dashboards

**Primary job.** Put the reports a person checks most on one page, in the order they read
them, without rebuilding the Reports screen's choices every visit.

**Where it lives.** A view of a project beside Reports (`/work/dashboards/PLT`, header tab
Dashboards, `G D`), in the `full` layout. The header holds the dashboard select, Add report and
the dashboard's ··· menu (New dashboard, Rename, Delete dashboard). The body is a two-column
grid of the Reports screen's own cards; a report is half or full width. On a phone the grid is
one column.

**What is on it.** Any of the built-in reports (burndown, burnup, velocity, cumulative flow,
created vs resolved, control chart, time in status, epic burnup, quarter) and pinned reports
saved elsewhere. A new dashboard starts with the project's usual set: Scrum gets burndown,
burnup, velocity, cumulative flow and the quarter; Kanban gets cumulative flow, created vs
resolved, control chart, time in status and the quarter. Dashboards are private to whoever made
them; the layout is stored on the server.

**Top three actions.**

| Action          | Mouse                                | Keyboard                              | Touch                   |
| --------------- | ------------------------------------ | ------------------------------------- | ----------------------- |
| Add a report    | Add report, then the report          | Tab to it, Enter, arrows, Enter       | Tap it, tap the report  |
| Reorder         | Drag the grip onto another report    | Tab to the grip, ↑ ↓                  | The report's ··· menu   |
| Remove / resize | The report's ··· menu                | Tab to ···, Enter, arrows, Enter      | Tap ···                 |

**Keyboard map.** `G D` was free. The grip takes ↑ and ↓ (one place each), as the settings
lists' grips do. No single keys.

**States.**

- Loading: the Reports skeleton.
- No dashboard: an EmptyState with Create dashboard, which makes "My dashboard" with the
  default set.
- Empty dashboard: an EmptyState pointing at Add report.
- One report's read in flight or failed: that card shows a skeleton or says it did not load.
- No sprint yet: the sprint reports say so in their cards.
- A pinned report whose kind this build cannot draw: the card says so and offers removal.
- A refused layout write: the server's layout comes back and a toast says to try again.
- Error: an EmptyState with Try again.

**URL state.** `?dashboard=<id>` (the first dashboard when absent).

**Choices recorded.**

- Drag uses the native drag the settings lists use (`useDragList`): the dragged tile dims, the
  tile under it lifts with `shadow-e1h`, and it lands in that tile's place. The grid is short
  enough that auto-scroll is the browser's own.
- Widgets are the Reports screen's cards with the tile's grip and menu in the header, so no
  card sits inside another and a report reads the same in both places.
- Sprint widgets follow the active sprint (else the latest started) and flow widgets the last
  30 days; per-widget settings are stored in the config but not yet editable on screen.
- Pinned reports keep the spec they were saved with; a renderer registers per spec kind, so a
  new kind needs no change to dashboards.

## Quarter

**Primary job.** See how a quarter is going for a team that plans by the quarter: how much is
done against how much of the quarter is gone, which sprints ran, and where each epic stands.

**Where it lives.** A view of a project (`/work/quarter/PLT`, header tab Quarter, `G Q`), in
the `full` layout, with the quarter select beside its heading. Also a dashboard report (the
burnup with the headline in its hint).

**What is on it.** Four figures (completed share with its count, share of the quarter gone,
issues finished, sprints), a weekly burnup of the quarter's scope and completed work, the
quarter's sprints as committed and completed points, and its epics with progress.

**Top three actions.** Pick a quarter (the select; Tab, Enter, arrows), open an epic (its key;
Tab, Enter), switch to the dashboard (`G D`).

**States.** Loading: the Reports skeleton. A quarter not begun: the burnup says so. No sprint
or epic in it: their cards say so. Error: an EmptyState with Try again.

**URL state.** `?quarter=2026-Q4` (the current quarter when absent).

**Choices recorded.**

- Quarters are calendar quarters in UTC; a fiscal-year offset is a later setting.
- Scope is the work open when the quarter began plus what was created in it; completed is what
  entered done inside the quarter and is done now, by its resolution time. Points when the work
  is estimated, issue counts otherwise. Epics are not counted as work themselves.
- The completed figure reads green when it is ahead of the share of the quarter gone and amber
  when behind, never red.
