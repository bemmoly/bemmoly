---
'@bemmoly/module-work': minor
'@bemmoly/web': minor
---

Automation rules have a new Time in status trigger: "when an issue has been in a status for more
than N hours or days". Pick the status and the span in the rule builder, add conditions and
actions as for any rule (for example, move stories that sat in Verification for more than five
days and match a filter to Done). The scheduler checks every minute and a rule fires once per
stay: an issue that leaves the status and comes back starts a new stay. A stay whose conditions
do not match yet is checked again until they do or the issue moves on.

An epic's Owner field now assigns its issues: an issue created in the epic, or moved into it,
with nobody assigned is assigned to the epic's owner. An assignee named in the same change wins,
and an issue somebody is already on keeps its assignees.

Schema: one changeset (0035) adds `automation_stays`, the stays a time-in-status rule has fired
for, with its unique key and an issue index. It is fast and reversible.
