# ADR 0019: AI changes data only through a step a person confirmed

- Status: accepted
- Date: 2026-10-11
- Tech design: [§11 AI subsystem](../tech-design.html#ai) (rule "never writes without a
  confirmed plan", §11.4 Plan → confirm → run)

## Context

The tech design makes "never writes without a confirmed plan" one of four AI rules and draws
the plan lifecycle in §11.4. It does not say how the rule holds in code once several modules
register tools, a model can call them in a loop, a job runs the steps later, and editor and
comment AI write text people keep. A rule that depends on every module author remembering it
would not survive the first module written in a hurry.

## Decision

The rule is enforced by structure, in the kernel, so a module cannot get it wrong:

1. **The model never holds a write.** A module registers each tool as `read` or `write`. For a
   planning call the kernel generates the AI SDK tool set: read tools get an `execute` that
   runs as the asking person; write tools get none, so the facade can only record the call.
   A recorded call becomes a plan step; nothing else turns model output into a write.
2. **A plan runs only on a person's confirmation.** `POST /ai/plans/:id/run` needs a person
   (never an API token or job), the `ai.actions.run` capability, Settings › AI "Let AI actions
   change data" on, and a plan still `proposed`. Approving and enqueueing the run job happen in
   one transaction, so a plan runs at most once, and only the steps marked ALLOWED, or the
   subset the person chose, are approved.
3. **Each step is checked again when it runs.** The job runs steps as actor kind `ai_plan`,
   acting for the person who confirmed, through the module's own services and with the tool's
   `authorize` called again, since permissions may have changed. Every step made writes an
   audit row pointing at the plan, and steps with an undo can be put back.
4. **Other AI surfaces propose; a person applies.** Ghost text enters the page only on Tab; an
   editor suggestion only on Replace or Insert, as one change undo reverses; a comment's fix
   only on Apply fix. Insights, answers and summaries write only their own AI tables
   (`ai_insights`, `ai_runs`), never module data.

## Consequences

- A new module gets the rule for free by registering tools as `read` or `write`; a write tool
  that needs to run during planning is impossible to express, by design.
- With actions off the palette still answers and still drafts plans, which show every step but
  never offer Run.
- A plan cannot outlive a change of heart: Cancel stops what has not run, and a step whose
  permission was revoked fails with the reason instead of writing.
- The integration tests assert the order on the real boot path: nothing changes after
  planning, the change lands after Run through the module's services, and the audit rows name
  the plan.

## Alternatives considered

- **Let write tools execute, with a confirmation prompt inside the tool.** Every module would
  carry its own guard, and one forgotten guard would let a model write.
- **Run approved plans in the request.** Simpler, but a long plan would die with a page refresh
  and could not report progress or resume.
