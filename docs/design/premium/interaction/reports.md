# Reports

**Primary job.** See how a sprint went and how work flows through a project: what got done,
what moved in and out, and whether the team keeps up with what comes in.

**Where it lives.** A fifth view of a project beside Board, Backlog, Roadmap and Pairing
(`/work/reports/PLT`, header tab Reports, `G E`), in the `full` layout: five sections, each
with its heading and the controls that change it on one row, then its reports as cards.
Sprint has the sprint select; Flow has the range; Statistics has its two fields; Epics and
versions has the kind and the epic or version. Time tracking follows the Flow range.

**What is on it.**

- Burndown: the chosen sprint's remaining points per day, against a dashed guideline from the
  first day's points to zero.
- Burnup: the same sprint's scope and completed points per day, so scope added mid-sprint
  shows as the scope line rising.
- Sprint report: completed, not completed, added after the start and removed, each with its
  issue count and points; every issue opens in the peek.
- Velocity: committed and completed points of the last six closed sprints.
- Cumulative flow: issues in to do, in progress and done at the end of each day of the range,
  stacked.
- Created vs resolved: running totals of issues created and resolved over the range.
- Control chart: one dot per issue finished in the range, at its completion date and its cycle
  time in days, with the mean and median as dashed lines.
- Time in status: the average days an issue stood in each status inside the range, counting
  only the issues that stood there, in workflow order.
- Time tracking: hours logged per week over the Flow range, who logged them and the issues
  that took the most, each opening in the peek.
- Statistics: issues counted by one field (status, assignee, type, priority, label, epic,
  version, component) as bars with each bucket's share, or crossed with a second field as a
  table with totals.
- Epic or version burnup: its scope and completed points at the end of each of the last 12
  weeks, so scope creep shows as the scope line rising.

Everything is rebuilt from issue history on read; nothing is stored for the reports.

**Top three actions.**

| Action            | Mouse                      | Keyboard               | Touch          |
| ----------------- | -------------------------- | ---------------------- | -------------- |
| Pick a sprint     | The sprint select          | Tab to it, Enter, arrows | Tap it       |
| Change the range  | The range control          | Tab to it, then ← →    | Tap a segment  |
| Open an issue     | Click it in the report     | Tab to it, Enter       | Tap it         |
| Pick an epic or version | Epics/Versions, then the select | Tab to them, ← →, Enter | Tap them |

**Keyboard map.** Checked against the global map: `G E` was free. The screen adds no single
keys of its own.

**States.**

- Loading: the toolbar's skeleton and three chart cards of the final size.
- No sprint has started (or a Kanban project): an EmptyState in place of the sprint reports;
  the flow reports still draw.
- No closed sprint: the velocity card says velocity starts with the first one.
- No issue finished in the range: the control chart says so. No epic or version: the burnup
  card says the project has none yet.
- One card's read in flight or failed: that card shows a skeleton or says it did not load;
  the rest of the page stays.
- Error: an EmptyState with Try again.
- Phone: the cards stack in one column and the charts redraw to the width.

**URL state.** `?sprint=<id>` (the active sprint, else the latest started, when absent) and
`?range=14|30|90` (30 when absent) for the flow reports, the control chart and time in status;
`?stat=<field>` (status when absent) and `?stat2=<field>` for the statistics;
`?scope=epic|version` (epic when absent) and `?target=<id>` (the first open one when absent).

**Choices recorded.**

- Charts use the status colours: to do `todo`, in progress `prog`, done `done`, scope `tx-2`,
  the guideline `tx-3` dashed. They are data about status, so they wear status colours, not the
  accent. Every number is in a hidden table under each chart for screen readers.
- The cumulative flow groups by status category rather than each status, so it reads the same
  across projects with different workflows and needs no new palette.
- Added and removed compare the sprint's issues at its start and its end; an issue that joined
  and left in between appears in neither.
- Resolved counts a move into a done status from an open one; reopening and finishing again
  counts twice, as it is work done twice.
- The control chart's cycle time is the one the Board's Flow tile uses: from first entering an
  in-progress status (or creation) to last entering done.
- Time in status shows averages per status rather than a row per issue; a per-issue table is
  a later addition if teams ask for it.
- The epic and version burnup is weekly, not daily: epics and versions run for months, and a
  daily line is noise at that span. An epic's issues are its direct children.
- Time tracking follows the Flow range; its weeks step from the range's first day so every
  bar is a full week. With no time estimate in the model, an issue shows its points beside its
  hours. The server also takes a sprint, which the screen does not offer yet.
- Statistics never draw a pie: one field is bars with shares, two fields a table. An issue
  with several labels or assignees counts in each of their buckets, so rows can add up to more
  than the total; shares are against distinct issues. The table tints by count with `acc-50`,
  `acc-100` and `acc-500`, not `acc-fill`, as its cells are not actions; counts are printed.
