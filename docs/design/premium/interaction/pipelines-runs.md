# Pipelines: Runs and a run

## Runs

**Primary job.** See what is running, queued and failing in the scope (`/pipelines/runs`, `G R`).

**What is on it.** All, In progress, Failed and Passed; Mine; a search over title, branch and
commit; a virtual table newest first (state, title with run number and applications, branch
and commit, trigger, author, duration, started). The first page refreshes from the live
counter's events while it is the only page loaded. The application page's Runs tab is the same
list narrowed to it.

**Keys.** `/` search, J into the rows, J K and Enter. **URL.** `?state=active|failed|passed`,
`?mine=true`, `?q=`, `?scope=`.

**States.** Skeleton rows; "No runs yet" (what starts one); "No runs match" with Clear filters;
Try again; phone keeps state, title and duration.

## A run

**Primary job.** Find why it failed and fix it (`/pipelines/runs/:id`).

**What is on it.** The title, run number, trigger and duration, its applications; Cancel while
active, Re-run all. The `StageGraph` (fan-out and fan-in, the selected node ringed, red when it
failed). Under it the selected job's `LogView`: opened on the first error (or the linked line),
following the end while the job writes, searched on the server, with line links. Beside it the
failed tests by name and line (flaky ones flagged "Failed 3 of last 50 runs on main",
quarantined ones marked) with Re-run failed, and the change (pull request or commit, author,
issue). A run built by the company's own CI links to its log there.

**Top three actions.**

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Read the failure | Click a node or a failed test | J K between nodes, `/` search the log | Tap |
| Re-run failed | Re-run failed | Shift+R | Tap |
| Open the change | The commit link | Tab to it | Tap |

**Keyboard map.** J K move between nodes in reading order (the graph also takes arrows when
focused), `/` focuses the log search (Enter and Shift+Enter step through hits, Escape clears), F
toggles Follow, Shift+R re-runs what failed. The shell's keys ignore Shift, so the screen's keys
use their own listener that tells Shift+R from R.

**States.** A skeleton shaped like the header, graph and log; "There is no run here"; the graph
and the log each have Try again; a job not started says why it waits ("3rd in Payments' queue,
about 40 s"); an empty log says the job has not written yet.

**URL state.** `?node=<job key>&line=<n>`.

**Choices recorded.** The AI card ("Why it failed") is not drawn: there is no explanation
endpoint yet, and with AI off nothing lilac may appear; it joins when the AI runtime offers a
failure explanation.
