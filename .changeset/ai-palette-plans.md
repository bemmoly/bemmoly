---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/api-client': minor
'@bemmoly/ui': minor
'@bemmoly/web': minor
'@bemmoly/module-work': minor
'@bemmoly/module-docs': minor
'@bemmoly/server': minor
---

The ⌘K palette can now do things for you with AI. All of it appears only while AI is on.

- **Ask or plan.** Type a request such as "move everything blocked by PLT-204 to next sprint"
  and choose **Plan with Bemmoly**, or press Mod+Enter. A question such as "what changed in
  auth this week?" gets **Ask Bemmoly** instead, which answers from your docs and issues with
  its sources.
- **Nothing changes until you confirm.** A plan lists each change: the issue, what changes and
  the field. Each change is checked against your own permissions. A change you can't make is
  marked Denied with the reason, and it is left out when the plan runs. **Edit plan** keeps
  fewer changes. Enter runs the plan.
- **Running.** Each change lands in turn, and you can stop the plan. It keeps running if you
  close the palette, and you are told when it ends. Comments a plan writes are signed "via
  Bemmoly for <your name>". **Undo** puts back everything that can be put back.
- **Honest states.** The palette says so when AI actions are turned off (the plan is a preview
  only), when the AI provider doesn't answer, when the monthly budget is spent, and when there
  is nothing to change. Search and every other command keep working.
- **For modules.** Work offers its search, issue, sprint, transition, member, label and project
  lookups, and moving, status, assignment, priority, labels, comments and new issues. Docs
  offers page search and reading, review status and page comments. Each tool takes the same
  input as the matching endpoint.

Admins should know:

- **Permissions:** drafting a plan needs "Use AI assist". Running one needs "Run AI actions
  that change data", and "Let AI actions change data" must be on in Settings › AI. Each step
  writes an audit row (`ai.plan.step_run`, actor kind `ai_plan`) that names the plan.
- **Schema:** one additive changeset, `0408-ai-plans`, adds the `ai_plans` and `ai_plan_steps`
  tables.
- **Jobs:** plans run in the new `ai.plan.run` job.
- **Performance:** the web app's first download is about 20 kB smaller. Components used only
  by later screens now load with those screens.
