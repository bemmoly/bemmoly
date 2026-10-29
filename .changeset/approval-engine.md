---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/api-client': minor
---

The kernel has one approval engine for every product (ADR 0051). Modules define versioned
workflows (ordered stages, conditions on request fields such as an amount, approvers by person,
role, manager or cost-centre owner, SLAs with escalation, and auto-approve rules), start
requests on their own records and hear the outcome as events. People see what waits on them
across products at `/api/v1/approval-requests`, decide with a comment, withdraw their own
requests, and name a delegate while away. Each step is audited and notified. Manager and
cost-centre rules find nobody until the person record is installed. There is no builder screen
yet; admins save definitions through `/api/v1/admin/approval-workflows`.

Schema: one kernel changeset (0801-approvals) adds `approval_workflows`,
`approval_workflow_versions`, `approval_requests`, `approval_tasks` and `approval_delegations`
with their indexes. It is fast and reversible.
