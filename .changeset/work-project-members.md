---
'@bemmoly/module-work': minor
'@bemmoly/web': patch
---

Projects now have members you can manage. Open Members from a project's row menu in the
project list, or from the project switcher, to see who can open the project and the role each
person holds in it. Project admins add people (found by name or email) or whole teams, change
a role in place, and remove someone after reading back what they lose. A project always keeps
one project admin. Whoever creates a project becomes its project admin, and everyone in the
owning team joins with the team's default role. People see only the projects they belong to in
the project list; org admins still see every project. Access to a project's issues, search,
boards and Home follows membership on the next request, and LQL issue queries, which failed
for everyone, now work and respect it too. Every change is in the audit log. The API is
`GET` and `POST /api/v1/work/projects/:key/members`, and `PATCH` and `DELETE
/api/v1/work/projects/:key/members/:userId`. No configuration or schema change.
