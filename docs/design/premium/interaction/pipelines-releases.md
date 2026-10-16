# Pipelines: Releases and Promote

## Releases (`/pipelines/releases`, `G E`)

**Primary job.** See what is waiting for my approval, then what is moving toward Prod in this
scope, and pick a release to promote.

**What is on it.** Link tabs (Releases, What changed?). Waiting for you: the promotions this
person can approve now (`GET /promotions?awaitingMe=true`), each with how many gates are met,
approvals given, who asked and when it expires. Below, one card switches Promotions (every
promotion in the scope, newest first, with its state and train) and Releases (every release,
searchable by version or commit, with where it runs and its tests). Both are keyset pages with
Show more. Refreshed by the `for-you` topic.

**Top three actions.**

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Review an approval | Review, or the row | J K, Enter | Tap the row |
| Open a promotion | The row | J K, Enter | Tap the row |
| Promote a release | Promote on its row | J K, Enter | Tap Promote |

**States.** Skeleton rows per table; Waiting for you empty says approvals land here with
their gates checked; promotions and releases empty name the scope and how a release appears;
a search with no match says what to try; each table fails on its own with Try again.

**URL state.** `?view=releases` (Promotions when absent), `?q=` for the release search, and
the scope.

## Promote (`/pipelines/releases/:releaseId/promote?to=prod`)

**Primary job.** Decide to ship: the person asking and the approver see the same screen.

**What is on it.** Title "Promote checkout-api v1.43.0 to Prod" with the tier and, once
requested, the state. Three cards: What's changing (commits between what runs there and this
release, issues first, migrations and config under Needs a closer look, the same release
elsewhere), Gates (GateList from the policies, approvals with who has approved and who still
must), Rollout (RolloutPlan waves, roll back by itself, and When: as soon as approved or a
train departure). While rolling out, the waves show progress and the canary is judged against
stable (MetricCompare), with Roll back. The decision bar is at the foot.

Before a request the screen reads `GET /promotions/preview` (nothing is written); an open
promotion of the same release to the same place replaces the preview (`?promotion=`).

**Top three actions.**

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Request approval | Request approval | Mod+Enter | Tap Request approval |
| Approve (or Reject with a reason) | Approve, Reject | A | Tap Approve |
| Roll back the canary | Roll back | Shift+B | Tap Roll back |

Also: Cancel request (the requester), Override the freeze (a Release manager, with a reason of
ten characters or more), Carry on for a paused canary.

**States.** Three card skeletons; a refused request says the policy's sentence and whom to ask
in the bar, with Request approval off; compare not available fails inside its card only; no
metrics source says the checks wait rather than pass; finished promotions show their outcome
reason and any freeze override.

**URL state.** `?to=` (an environment key or class), `?promotion=`.

**Choices recorded.** The contract gained `GET /promotions/preview`, `release.digest` (sent
back with an approval) and `previous` (for "v1.42.3 to v1.43.0"). Turning the automatic roll
back off is not offered when the plan has it on: a request may be narrower, never less careful.
