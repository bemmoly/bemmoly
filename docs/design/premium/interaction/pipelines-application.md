# Pipelines: Application

**Primary job.** Know what runs where and promote (`/pipelines/applications/:key`).

**What is on it.** The name, tier and labels; Run, Roll back… and Promote to Prod…. Tabs
Overview and Runs. Overview: the environment strip (Dev › Staging › every Prod region, the
version in each and what is moving, "canary 25% over v1.42.3", "next wave, after asia"); the
selected environment compared with the one before it ("Prod · us-east1 is 4 commits behind
Staging": commits, issues, migrations, configuration, a link to the forge's compare); recent
runs; Prod health (canary against stable with `MetricCompare`, or the application's health
when nothing is moving); About (owner, repository, template, runtime, the last 30 days).
Variables: see below.

**Top three actions.**

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Promote | Promote to Prod… | P | Tap |
| Roll back | Roll back… (choose the environment, a reason) | Shift+B | Tap |
| Run the pipeline | Run (branch and typed inputs) | R | Tap |

**Keyboard map.** P, Shift+B and R as above; Mod+Enter submits a dialog; Escape closes it. All
three are in the palette, which can also open them from any screen ("roll back pricing-svc").

**States.**

- Loading: strip and card skeletons in place.
- Not found: "There is no application called …" with Go to the catalog.
- Error: each block has its own Try again, so a failing compare never hides the strip.
- Nothing to promote or roll back: the buttons are disabled and their tooltips say why.
- Refused: the dialog shows the policy's sentence and "Ask <who>".
- Phone: the strip scrolls sideways; the cards stack.

**URL state.** `?env=<environment>` (the compared environment), `?tab=runs|variables`,
`?dialog=run|rollback|promote`, and the scope for the crumbs.

**Choices recorded.** Promote targets the release one stop before Prod and opens the Promote
screen; the strip contract gained `releaseId` and `deploymentId` for that, for the canary card
and for Roll back. Roll back never waits for a window or a freeze, and says so.

## Variables tab

**Primary job.** Set what a deploy runs with, and keep secrets out of sight
(`?tab=variables`).

**What is on it.** A picker for every environment or one (`?env=`, shared with Overview), a
sentence saying what the view means, and a table: name (with a Secret tag), value, version,
who set it and when. In one environment's view its own values sit over the shared ones, and a
shared one says "From every environment". A plain value shows and edits in place. A secret
says "Set, never shown" with Replace…; one from before secrets existed says it is waiting to
move into Secret Manager and why. A note says values reach a service at its next deploy.

**Top three actions.**

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Add a variable | Add variable (name, Plain or Secret, value) | N | Tap |
| Change a value | Edit beside a plain value; Replace… beside a secret | Enter saves, Escape leaves | Tap |
| Delete, or give one environment its own value | The row's ··· menu | Tab to ···, Enter | Tap ··· |

**States.**

- Loading: three skeleton rows.
- Empty: "No variables yet" and what adding one does.
- Error: "The variables did not load" with Try again; a refused write shows the rule's sentence
  and whom to ask under the table or in the dialog.
- No permission: Add variable is disabled with a tooltip saying who may; rows show no menu.
- Phone: version and set by are left out; the picker and Add variable wrap.

**Choices recorded.** Environments are a picker, not columns: five Prod regions do not fit a
phone, and one view answers "what does a deploy here get". A secret's value shows while it is
typed, in a monospaced box, so a pasted key can be checked; it is never shown again. Deleting
asks first, since a secret cannot be brought back from here; saving a plain value offers Undo.

## Settings tab

**Primary job.** See how the application runs in each environment, apart from where, and
change it there without a commit (`?tab=settings`).

**What is on it.** A sentence on which value wins, then one card per environment: its name, its
runtime, "One pod at a time may go during upgrades" where a disruption budget applies, Edit and
(once something is set here) Clear, and a table of every setting with its value and where it came
from (Set here, application.yaml for the environment, application.yaml, Default). A setting the
runtime does not have says "Not on Cloud Run" or "Not on GKE Autopilot". Under the table, the
release whose application.yaml was read.

**Top three actions.**

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Change an environment's settings | Edit on its card (each field shows what an empty one falls back to) | Tab, Enter; Cmd+Enter saves | Tap |
| Go back to the file and the defaults | Clear on its card, then confirm | Tab, Enter | Tap |
| Read where a value came from | The From column | Tab through the table | Read |

**States.** Loading: six skeleton rows. Error: "Deploy settings did not load" with Try again.
Settings that contradict (min above max): the sentence in amber on the card, and saving is
refused with it. No permission: the dialog shows the rule's sentence and whom to ask. Phone: the
cards stack and the table keeps its three columns.

**Choices recorded.** One card per environment, not a grid of environments by settings: five
Prod regions do not fit a phone, and a card answers "what does a deploy here get". Saving
replaces every setting made here, so the dialog starts from what is held and an empty field
always means "follow the file".

## Variable addresses

**Primary job.** Let one service call another by name in every environment.

**What is on it.** Under a plain value in the Add dialog, "Insert another application's address"
(searchable, two choices per application: its address in the same environment and its public
address) and a sentence saying callees deploy first. In the table, under such a value, one line
per environment with the address filled in, or in amber why it cannot be yet.

**Choices recorded.** The reference is text in the value, so it can sit inside a longer URL and
the file, the API and the screen say the same thing.

## Where it runs

**Primary job.** See and switch the runtime the application's next deploy uses in each
environment, without a commit.

**Top three actions.** Choose a runtime for one environment (the line's select, by mouse, Tab
and Enter, or tap); go back to the default (the select's first option, "Default: …"); read why
a deploy would fail (the amber sentence under the line).

**States.** Loading: one skeleton line. Error: the card's own Try again. Refused: the server's
sentence under the card. Many environments: one line each, in path order. Phone: the card
stacks with the others.

**URL state.** None; the choice is stored in Pipelines.

**Choices recorded.** A select per environment rather than a dialog, since the choice is one
value and takes effect on the next deploy, not now. The default option names what it follows
(application.yaml, then the environment), so nobody has to guess.

Where a front door serves the application, a switch plans a move instead of waiting for the
next deploy. The line then shows the move's target and a link under it ("Move to GKE Autopilot
planned. Review the plan", "Moving to GKE Autopilot: 10%"), and the card's foot says a switch
there has no downtime.

## Front door

**Primary job.** Show where callers reach the application in each environment with a front
door, and how its traffic is split between runtimes now.

**States.** Loading: one skeleton line. Error: the card's own Try again. None: one sentence
saying an admin turns a front door on in Platform › Environments. During a move: both runtimes
with their shares. Phone: the card stacks with the others.

**URL state.** None.

**Choices recorded.** A side card, not a tab: it is a few lines per environment and reads
beside Where it runs. Without a domain the card names the Host header to send, since the
address alone does not reach the application.

## Moving between runtimes

**Primary job.** Decide whether to move an application to another runtime, then follow and
steer the move.

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Start the move | Start the move in the header | Tab, Enter | Tap |
| Pause, then Continue | Pause, Continue in the header | Tab, Enter | Tap |
| Roll back (Cancel the plan before it starts) | Roll back in the header | Tab, Enter | Tap |

**Order.** The steps, the downtime, the month's cost and what is untested come first, before
any action, so the decision is made on them. The cost says it is an estimate and the date its
prices were read.

**States.** Loading: two card skeletons. Error: Try again. Planned: Start and Cancel the plan.
Moving: Pause and Roll back; the screen follows the move every five seconds. Paused: Continue
and Roll back. Ended (moved, rolled back, failed, cancelled): no actions, Back to the
application. A refused action shows the server's sentence above the cards. Phone: the cards
stack in the same order.

**URL state.** `/applications/<key>/moves/<id>`: the move.

**Choices recorded.** The steps reuse `RolloutPlan` as three waves (deploy and wait, shift,
remove), so a move reads like a canary. Roll back needs no confirmation: it only ever returns
traffic to where it ran before.
