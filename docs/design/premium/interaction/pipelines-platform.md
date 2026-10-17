# Pipelines: Platform

Platform (`/pipelines/platform`, `G P`) is one title with link tabs: Access, Capacity, Clouds,
Environments. `/platform` opens Access.

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

## Clouds and Connect a cloud

**Primary job.** Connect a cloud and see what Pipelines made there. Each connection shows who
Pipelines acts as, its boundary and layout; a failed check is one amber band with Reconnect,
and the last known state stays. Connect a cloud: provider cards (Coming soon and nothing else
for clouds not ready), what Google Cloud needs (no key file), then the layout chooser beside the
preview tree of every folder and project; blockers keep Create off. Applying shows the accounts
being made (ProvisionChecklist). `?connection=` opens step two.

## Environments

Paths by tier (stages in order, parallel environments stacked, what moves a release on and
how long it bakes) and every environment with its cloud, region and protection. Read only:
the contract has no environment writes yet.
