# ADR 0051: One approval engine in the kernel

- Status: accepted
- Date: 2026-10-22
- Changes: the kernel's service list in the tech design (adds `approvals` beside notifications,
  audit and jobs)
- Evidence: the business suite proposal (`docs/proposals/suite/`), where leave, onboarding,
  expenses, timesheets, asset requests, access grants and offers all need "someone must say
  yes before this happens"; how approval tools in each of those categories model it (stages,
  amount thresholds, the requester's manager, delegates while away, escalation after a delay)

## Context

Every product in the suite asks for approval, and the market's tools each keep their own rules,
their own delegates and their own reminders. If each Bemmoly module built its own, a person
would set an out-of-office delegate seven times and have seven places to look for what waits on
them. The engine has to exist before the first product does, and it cannot depend on the person
record (manager, cost centre), which is being built at the same time.

Three shapes were weighed:

- **A rules language (CEL, as Pipelines uses).** Expressive, but an admin builder over free
  expressions is hard to make safe and plain, and approvals need only comparisons on a few fields.
- **Each module owns its workflow and calls a kernel helper for notifications.** Small, but
  delegation, "waiting on me" and escalation would be rebuilt per module.
- **A kernel service with declarative, versioned definitions.** One store, one runtime, one
  inbox; modules start requests and listen for the outcome.

## Decision

The kernel has an `approvals` service. Modules never import each other; they reach it through
the kernel, as they reach audit and notifications.

**Definitions.** A workflow belongs to a module and has a key (`expenses.claim`). Each save is a
new immutable version; a running request stays on the version it started with. A version is:

- `autoApprove`: groups of conditions; if every condition of any group holds, the request is
  approved at once without a stage.
- `stages`: in order. Each has optional `when` conditions (all must hold, otherwise the stage is
  skipped), one or more approver rules, a mode (`all` must approve, or `any` one approver
  decides for the stage), and an optional SLA in hours with an escalation rule.
- Conditions compare one request field (`amount`, `costCentre`, `days`) with `eq`, `neq`, `gt`,
  `gte`, `lt`, `lte`, `in` or `exists`. No expressions, no code.
- Approver rules: a `user`, everyone with a `role`, the requester's `manager` (with `levels`,
  1 for the direct manager, N for N levels up) and the `cost_centre_owner`.

**Resolution is pluggable.** Rules become people through an `ApproverResolver`
(`contracts/approvals.ts`). The shipped resolver answers `user` and `role` from the users and
roles tables and asks an `OrgLookup` for managers and cost-centre owners; the shipped lookup is a
stub that knows nobody. The person record implements `OrgLookup` (or a whole resolver) without
touching the engine. Requesters never approve their own request, and deactivated people are
left out. A stage that resolves to nobody is an error at the moment it starts, so a request
never waits on no one.

**Runtime.** A request is owned by a module (`moduleId` and a subject `{ kind, id }`) and carries
the fields the conditions read, frozen at start. Its status is `pending`, `escalated` (an SLA
passed; still open), `approved`, `rejected` or `withdrawn`. One task per approver per stage;
a rejection ends the request, an approval completes the stage when the mode is satisfied, and
the last stage completes the request. Only the requester withdraws, only while open. Every
decision keeps its comment.

**Delegation.** A person names a delegate for a period. When a stage starts, a task for someone
away goes to their delegate instead and remembers whom it was for; one hop only, so delegates
never chain.

**Side effects.** Every mutation writes an audit row through `AuditRecorder` in the same
transaction; approvers and the requester are told through `notification.requested`
(`approval_requested` and `approval_decided`, both immediate); the bus carries
`approval.requested`, `approval.stage_started`, `approval.decided`, `approval.escalated`,
`approval.approved`, `approval.rejected` and `approval.withdrawn`, each with the module id and
subject so the owning module can act. SLAs are pg-boss jobs (`approval.escalate`) enqueued with
`startAfter` and a per-task key; the handler re-reads the task and does nothing if it was
decided meanwhile.

**HTTP.** `/api/v1/approval-requests` lists what waits on the caller across modules, shows one
request to its requester, its approvers and admins, records decisions
(`POST …/:id/decisions`) and withdrawals (`POST …/:id/withdraw`). `/api/v1/approval-delegations`
is the caller's own delegation. `/api/v1/admin/approval-workflows` reads and versions
definitions for admins (`workspace.settings.manage`). Starting a request is in-process only:
the module checks its own subject's authorization first, so no HTTP route can open a request on
a subject the caller cannot see.

## Consequences

- One "waiting on me" list and one delegate setting serve every product.
- The person record (ADR 0050) answers manager and cost-centre rules through
  `createPersonOrgLookup`. A requester with no manager still fails to start a manager stage
  with a validation error, so a request never waits on no one.
- A module ships its default workflow with `ctx.approvals.ensureWorkflow`: saved as version 1
  when the key does not exist, never over a version an admin saved.
- The builder UI is out of scope; definitions are saved through the admin API.
- Conditions are deliberately weak. A rule that needs more than comparisons on fields is a new
  ADR, not a widening of the condition schema in passing.
