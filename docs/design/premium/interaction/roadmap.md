# Roadmap

**Primary job.** See when the big pieces of work (epics and versions) land, and whether they
will land on time, then move a date where it has to move.

**Where it lives.** A third view of a project beside Board and Backlog (`/work/roadmap/PLT`,
header tab Roadmap, `G R`), and one view across every project you can open
(`/work/roadmap`, from the Work section's "Roadmap" link). Both are the `full` layout: the
filter row, the forecast strip, then one timeline pane that scrolls both ways with its date
header and its name column sticky.

**What is on it.** One row per epic (its stored colour, name, key, forecast chip) and per
unreleased version (a neutral bar ending in a release mark). An epic opens to its issues, each
a thin bar when it has dates. A bar runs from the start date to the target date; its darker
part is the share of issues done. Past the target, a hatched amber stretch reaches the
forecast date ("Forecast Nov 1"). Under every open item a thin whisker shows the forecast
range, its dot the likely date. A dependency is a line from the end of the blocking bar to the
start of the waiting one, amber when the waiting one is planned to start first.

**Top three actions.**

| Action                        | Mouse                                       | Keyboard                                   | Touch                          |
| ----------------------------- | ------------------------------------------- | ------------------------------------------ | ------------------------------ |
| Read a forecast in words      | Click the forecast chip, or "View forecast" | F on a focused row or bar                  | Tap the chip                   |
| Reschedule an epic or version | Drag the bar; drag either end to resize     | ← → move a day, Shift with them a week     | Tap it; set its dates in the peek  |
| Open the epic                 | Click the name                              | Enter on the name                          | Tap the name                   |

**Keyboard map.** Checked against the global map: no single key here is global, and none
fires while typing, in a menu or dialog, or with Alt held.

| Keys              | Does                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| ↑ ↓, J K          | Move between rows (names and bars stay in step)                      |
| Enter             | Open the epic in the peek (`?issue=KEY`); on a version, its forecast  |
| ← →               | On a bar: move it a day earlier or later. On a name: fold, unfold    |
| Shift + ← →       | On a bar: move it a week                                             |
| Alt + ← →         | On a bar: move only its end a day                                    |
| F                 | Open the focused item's forecast (`?forecast=ID`)                    |
| T                 | Scroll to today                                                      |
| W, M, Q           | Zoom to weeks, months, quarters                                      |
| G R               | Go to the project's roadmap (from Board and Backlog too)             |
| Esc               | Close the forecast or peek; during a drag, put the bar back          |

**Rescheduling.** A drag shows the new dates above the bar as it moves and snaps to days; the
grips at either end move one date (Alt with the arrows does the same for the end). The
bar keeps its place in the same frame on drop (optimistic), dims after a 160ms beat while the
change is on its way, and a toast says "Billing v2 moved to Sep 29 – Oct 28" with Undo for six
seconds. A refusal puts the bar back with "Couldn't move Billing v2" and Try again. Keyboard
moves are sent once the keys rest for half a second, as one change. Only people who can edit
issues move epics, and only project admins move versions; for everyone else the bar has no
grip and the arrow keys do nothing.

**The forecast.** Computed on the server from the project's own history (the Board's flow and
sprint metrics): completed points per sprint when the project runs sprints with estimates,
else completed issues per week. A thousand simulated futures drawn from that history give the
likely date (half of them finish by it) and the range (from 15 to 85 in 100). The panel says
in plain words what it used, what is left, who else shares the team, what it waits on, and how
sure it is and why. With too little history it says so and how much more it needs, never a
made-up date.

- **Chip**: On track (green), At risk (amber: likely on time, not certain), Late (amber, with
  the days), Done (status glyph), No target (quiet text), Not enough history (quiet text).
- **Strip**: when something is at risk or late, one neutral line under the filter row names
  the item that slips most and what waits on it, with "View forecast" and Dismiss (remembered
  for the session). Nothing at risk, no strip.
- **Panel**: the `Drawer` (docked 400px when there is room, else over the page with a scrim)
  at `?forecast=ID`; Back closes it. The peek and the panel never show together.

**States.**
- Loading: the filter row, then a skeleton of the name column and bars with the final heights.
- Empty project: "No epics or versions yet", how they get here, "New epic".
- Filtered empty: "Nothing matches these filters" with Clear filters.
- Error: "The roadmap did not load", what was not lost, Try again, in the frame.
- Partial: items without dates sit in their rows with "No dates" and their forecast whisker
  from today; items with history too short say so in their chip.
- Many items: hundreds of rows scroll in the one pane; groups fold.
- No permission: a project you cannot open is left out of the all-projects view; a link to it
  says there is no such project you can see. Bars you cannot move have no grip.
- Phone: the name column narrows to 132px and drops the chip; the filter row scrolls sideways;
  months is the default zoom; bars do not drag on touch (a drag there scrolls the timeline), so dates move in the epic's peek.

**URL state.** `zoom` (weeks, months, quarters), `group` (project, team, none), `show`
(versions, done), `team`, `q`, the open `issue` or `forecast`. A link reproduces the view.

**AI.** The forecast is arithmetic, not AI, so it is drawn in neutral and signal colours only.
The panel keeps one slot under the explanation for a commentary by AI; it renders only with AI
on, and nothing fills it yet.

**Choices recorded.**
- Today is an accent line (`acc`), not red: red means an error, and today is where you are.
- Late is amber, not red: it is a warning about a date, not a failure, and an epic is never red.
- A bar's progress is its own epic hue, deeper, as the Backlog's epic rail draws it; versions
  are neutral because they carry no colour of their own.
- The mock's violet dependency dot is a line instead: violet is the epic and AI band.
- "Show scenarios" from the mock is the AI forecast's job and waits for it.
