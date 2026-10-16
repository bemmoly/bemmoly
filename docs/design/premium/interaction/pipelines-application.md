# Pipelines: Application

**Primary job.** Know what runs where and promote (`/pipelines/applications/:key`).

**What is on it.** The name, tier and labels; Run, Roll back… and Promote to Prod…. Tabs
Overview and Runs. Overview: the environment strip (Dev › Staging › every Prod region, the
version in each and what is moving, "canary 25% over v1.42.3", "next wave, after asia"); the
selected environment compared with the one before it ("Prod · us-east1 is 4 commits behind
Staging": commits, issues, migrations, configuration, a link to the forge's compare); recent
runs; Prod health (canary against stable with `MetricCompare`, or the application's health
when nothing is moving); About (owner, repository, template, runtime, the last 30 days).

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

**URL state.** `?env=<environment>` (the compared environment), `?tab=runs`,
`?dialog=run|rollback|promote`, and the scope for the crumbs.

**Choices recorded.** Promote targets the release one stop before Prod and opens the Promote
screen; the strip contract gained `releaseId` and `deploymentId` for that, for the canary card
and for Roll back. Roll back never waits for a window or a freeze, and says so.
