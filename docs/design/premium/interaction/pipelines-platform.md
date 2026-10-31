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

GKE Autopilot is the third card. Its fields: project and region as for Cloud Build, the
cluster (bemmoly-runners by default; in a CI project Pipelines made, a ticked "Create the
cluster if it is missing", and in an attached project a hint that it must exist), the runner's
gke image, vCPU and memory per runner (the memory must be 1 to 6.5 GiB per vCPU), Use Spot
capacity, the pod service account, fewest runners (room kept warm; 0 scales to zero), most
runners at once, and the image builder (empty keeps Kaniko). No token. Its row says "GKE
Autopilot · region · cluster" and "n of m pods", with the pods now under the scaling ("1
running · 0 starting · 2 warm"); while Pipelines prepares the cluster a spinner and GKE's
words sit under its name, and a preparation that failed shows its reason in amber. Its pods
join Builds now, each linking to its page in GKE.

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

### Create projects for me

**Primary job.** Turn what `deploy/gcp/bootstrap.sh` printed into projects Pipelines made, and
see each one before it exists. **Top three actions**: Connect and check (the form's submit,
Enter in any field); choose Starter, Standard or Enterprise (radio cards, arrow keys within the
group, tap); Create N projects (the footer's primary button). Retry on a stopped apply is the
fourth, on its band. No screen keys beyond the global map.

**States.** The form waits for a valid folder, billing account and control project, and says
what is wrong only once something was typed. The grant check shows Checking, then either
"Bemmoly holds what it needs" or one amber line per role to grant, with Check again. The plan
loads as a skeleton; blockers (amber) keep Create off, warnings (neutral: moves, kept projects,
billing headroom) do not. The apply shows every project's state, then "The landing zone is
ready" with Open environments, or one amber sentence with Retry. Phone: the chooser and the
plan stack.

**URL state.** `?mode=` (managed or attached), `?connection=` (the grant check and plan),
`?plan=` (the apply being followed, so a reload keeps it).

**Choices recorded.** The layout cards are SelectableCards, as the mode choice above them, so
each can say what it creates; a connection made with another layout keeps it as a fourth card.
Kept projects use the neutral chip, since nothing happens to them. Warnings are neutral, not
amber, because they never stop Create.

## Environments

Paths by tier (stages in order, parallel environments stacked, what moves a release on and
how long it bakes) and every environment with its cloud, region and protection. Read only:
the contract has no environment writes yet.

**Runtime choice.** In New environment and Edit, "Applications run on" lists each runtime with
one sentence on what it costs, repeats the chosen one's sentence under the field, and in Edit
counts the applications following the default and names those that chose otherwise.

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

## Front doors

**Primary job.** Give an environment a stable address, so its applications move between
runtimes with no downtime.

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Turn a front door on, or edit it | Turn on… or Edit… on the row | Tab, Enter | Tap |
| Name or clear its domain | Domain in the dialog | Tab, type | Tap, type |
| Turn it off | Front door on in the dialog, then Save | Space, Enter | Tap |

**States.** Loading: row skeletons. Error: Try again. Off: one sentence saying what a switch of
runtime does there without one. Being made: polled every three seconds. Ready: the address,
the domain or "No domain", and how many applications it serves. Problems: one sentence each,
such as a certificate waiting for DNS. Phone: each row stacks.

**URL state.** None.

**Choices recorded.** A panel under the environments rather than a column in their table: a
front door has an address, a domain and problems of its own. The dialog says what each choice
means for DNS and certificates beside the field.

## Export

**Primary job.** Take everything Pipelines made away as Terraform and Helm, and see what the
bundle holds and leaves out before downloading it. One card per connection: its files, the
values to fill in before a plan, and what was left out and why.

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Download the whole export | Download export, the area's primary button | Tab, Enter | Tap |
| Download one connection | Download on its card | Tab, Enter | Tap |
| Export one application | Export on the application's page | Tab, Enter | Tap |

**States.** Loading: row skeletons. Empty: nothing exported yet, with what to do first. Error:
Try again; a refusal names the platform admin rule. Download shows a toast with the file's
name; a failure shows one amber line above the cards (on the application's page, a toast).
Phone: each card stacks its files above what to fill in and what was left out.

**URL state.** None.

**Choices recorded.** The page previews the bundle and downloads with the browser, so a large
zip never passes through page memory. Before you plan and Left out are neutral, not amber:
neither stops a download. The application's Export asks for the preview first, so a refusal
or nothing to export reads as a sentence instead of a failed browser download.
