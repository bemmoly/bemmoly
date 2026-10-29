# Pipelines: Platform

Platform (`/pipelines/platform`, `G P`) is one title with link tabs: Access, Capacity, Clouds,
Environments, Clusters. `/platform` opens Access.

## Access

**Primary job.** Decide and explain who may do what. Scope tree on the left (sets `?scope=`),
role bindings at that scope with inherited ones marked and the owning teams counted, policies
as sentences or code, and the checker.

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Bind a role | Add binding | N | Tap Add binding |
| Check access | The checker's fields | C | Tap the fields |
| Remove a binding | ··· then Remove, Undo in the toast | Tab to ···, Enter | Tap ··· |

A binding for one person needs an end time and a reason (break-glass). The checker's question
is in the address (`?who=&action=&app=&env=`) and the answer is AccessExplain with whom to ask.
Below 1024px the tree is left out; the top bar's scope switcher does its job.

## Capacity

**Primary job.** See whether runners keep up and why jobs wait. Five headline numbers, runner
pools busiest first, concurrent jobs against the slots, fair share by team (borrowing in
amber), the queue with a reason for every wait. `?range=7d|30d`. Live from the `capacity` topic.
Add runner pool and Rotate token show the new token once, to copy.

Where a pool's runners come from is one choice of two cards in Add runner pool and in the
row's ··· › Change where it runs…: Machines you start (runs on, where, fewest and most runners;
the token is shown once after) or Google Cloud Build (project from the ready CI and attached
projects, region from its connection, runner image, build service account, machine type, most
builds at once; no token). A field shows its error once it has something in it, and the
primary button stays off until every field reads; ⌘ Enter saves. A Cloud Build pool's row
says "Google Cloud Build · region · project" and "n of m builds", and why its last build would
not start in amber under its name. Builds now, shown once any pool runs on Cloud Build, lists
each build still starting or running: the job (to its run), the pool, when it started and
Google's log in a new tab; empty, it says builds start when a job waits and end with it.

## Clouds and Connect a cloud

**Primary job.** Connect a cloud and see what Pipelines made there. Each connection shows who
Pipelines acts as, its boundary and layout; a failed check is one amber band with Reconnect,
and the last known state stays. Connect a cloud: provider cards (Coming soon and nothing else
for clouds not ready), what Google Cloud needs (no key file), then the layout chooser beside the
preview tree of every folder and project; blockers keep Create off. Applying shows the accounts
being made (ProvisionChecklist). `?connection=` opens step two.

An attached connection also says which of its projects holds CI secrets and secrets set for
every environment, chosen in place from its ready projects. A managed connection uses its CI
project.

## Environments

Paths by tier (stages in order, parallel environments stacked, what moves a release on and
how long it bakes) and every environment with its cloud, region and protection. Read only:
the contract has no environment writes yet.

## Clusters

**Primary job.** Give an environment the one cluster its applications on GKE deploy into, and
see whether deploys there can go.

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Create or attach a cluster | Create a cluster… or Attach a cluster… on the row | Tab, Enter | Tap |
| Check it again | Check again on the row | Tab, Enter | Tap |
| Forget an attached cluster | Forget, then confirm | Tab, Enter | Tap |

The button follows the environment's connection: a managed connection creates (Autopilot or
Standard, a name), an attached one attaches (project, location, name, optionally the owners'
Gateway). The dialog answers with the cluster as its check left it, problems included.

**States.** Loading: row skeletons. Empty: no environments yet. Error: Try again. An
environment with no project says to choose one first. Creating: polled every ten seconds
until GKE says it runs. Failed: the problems, each a sentence saying what to grant or turn on.
Phone: each row stacks the environment above its cluster.

**URL state.** None.

**Choices recorded.** Rows are environments, not clusters, because the rule is one cluster per
environment and the empty rows are where the action is. Forget is offered for attached clusters
and failed created ones only; Pipelines keeps running the clusters it created.
