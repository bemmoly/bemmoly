# Pipelines: Release map

**Primary job.** See the organisation's delivery on one screen and rewind it (`/pipelines/map`,
`G M`).

**What is on it.** Rows are the scope's children (domains at the organisation, groups inside a
domain, applications inside a group); columns are Build and test, then each environment, Prod
marked with the shield. A cell is a `DeployCell`: a lane with a dot per release moving, the
count, what is moving and at most two flags (failed in red, waiting or rolled back in amber, a
note such as "train 11:00"). The legend, the totals and Team and Tier filters sit above; the
last 24 hours of deploys sit below as a `TimeScrubber` with incidents in red. One request per
scope (`GET /map`); live maps refetch on their `map:<scope>` topic (coalesced to once a
second), rewound maps never refetch. It draws counts per cell and dots only for moving
releases, so 1,140 applications cost ten rows.

**Top three actions.**

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Zoom into a domain or group | Click its name | Up Down to it, Enter | Tap the name |
| Open a moving release's application | Click an application row's cell | Enter on the row | Tap the cell |
| Rewind | Drag the timeline, or click a bar | `[` and `]` step 15 minutes, L is live | Drag |

**Keyboard map.** Up and Down move between row names; Enter zooms (or opens an application);
Right opens a domain in place, Left closes it; Backspace zooms out; `[` `]` step the time; L
returns to live. The scrubber is a slider: arrows step a bucket, Shift an hour, Home the oldest,
End live. Checked against the shell: no collisions.

**States.**

- Loading: a grid skeleton of nine rows and six columns.
- Empty: "No applications in this scope" with what makes them appear.
- Error: Try again in place of the grid; the timeline waits for data.
- Rewound: the title row says "as it was at …", dots hold still, Back to live is offered.
- Many items: a group with sixty applications is sixty rows; the grid scrolls in the page.
- Phone: the grid scrolls sideways inside its card with the row names sticky; the timeline
  keeps only its first and last tick.

**URL state.** `?scope=commerce/checkout&at=<iso>&team=<id>&tier=0&open=commerce,data`.

**Choices recorded.** The drawing shows Commerce opened in place with its groups; that is
`open=` (only at the organisation), while clicking a name zooms the scope as the design's notes
say. Clicking a cell of an application row opens the application at that environment
(`?env=`).
