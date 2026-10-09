---
'@bemmoly/core': minor
---

Modules can now manage who belongs to a project or a space. The module context carries a
membership service whenever the database is present: list the members with their role, add
people or whole teams (each team member takes the team's default role, everyone else Member,
unless a role is named), change a member's role and remove a member, inside the module's own
transaction. Access follows on the next request, since authorization reads membership every
time. No configuration or schema change.
