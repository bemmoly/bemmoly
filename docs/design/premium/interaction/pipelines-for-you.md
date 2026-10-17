# Pipelines: For you

**Primary job.** Know where my changes are and what needs me, at a glance, the moment I open
Pipelines (`/pipelines/`, `G Y`).

**What is on it.** A greeting with the organisation's pulse for today (runs, deploys to Prod,
change failure, median lead time). Left: the person's changes as journeys, one card each, from
Build to the last Prod region, with the live station marked, a line saying what is happening
now and the one action that moves it on. A segmented control switches In flight and Shipped
(this week). Right: Waiting for you (approvals with their gates already evaluated), Your teams
(main healthy or broken, and who broke it), On call (with What changed?). Nothing here belongs
to anyone else. One request (`GET /for-you`), refreshed by the `for-you` stream topic.

**Top three actions.**

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Open a journey (its run, or its promotion) | Click the title or Open | J K to it, Enter | Tap the title |
| Approve | Review on the first approval | A | Tap Review |
| Re-run my failure | Re-run failed on the failing journey | Shift+R | Tap Re-run failed |

**Keyboard map.** J and K move the selected journey (accent border, scrolled into view), Enter
opens it, A opens the first approval's Promote screen, Shift+R re-runs what failed in the first
failing journey. None collides with the shell's keys (`G` chords, `T`, Mod+K); all are in the
palette's "On this screen" group.

**States.**

- Loading: three journey skeletons shaped like the cards, a skeleton side panel.
- Empty: "Changes you push show here as journeys…"; Shipped empty says nothing shipped this week.
  Waiting for you empty says approvals will appear with their gates checked.
- Error: the journeys area shows Try again; the pulse has its own Try again.
- Partial: Your teams and On call are left out when there is nothing to show.
- Many items: journeys stack; each journey scrolls its stations inside itself.
- Phone: one column, side panels under the journeys; stations scroll inside the card.
- A refused re-run shows the policy's sentence and "Ask <who>" above the journeys.

**URL state.** `?tab=shipped` (In flight when absent).

**Choices recorded.** Review opens the release's Promote screen
(`/releases/:releaseId/promote?promotion=…`), so the waiting approval contract gained
`releaseId`. A train approval opens the releases inbox. "Remind approvers" opens the promotion
(there is no reminder endpoint yet).
