---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/api-client': minor
---

The kernel keeps a person record for each employee: employment state, start and end dates,
job title, level, manager, team, location and cost centre, plus locations (with time zone and
holiday calendar) and cost centres (with an owner). The API is /api/v1/people,
/api/v1/locations and /api/v1/cost-centres; anyone signed in can read them, and a new
capability, "Manage people records" (org admins by default), writes them. Schema: the
changeset 0800-people adds the locations, cost_centres and people tables.
