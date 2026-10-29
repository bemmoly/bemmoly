---
'@bemmoly/module-people': minor
'@bemmoly/core': minor
---

A new module, People, off until an admin enables it: a directory of everyone with an
employment record and what is happening to them, profiles with company fields, an org chart
by reporting line, team, location or cost centre, time off with policies per location,
balances, a team calendar and requests the employee's manager approves, and onboarding and
offboarding journeys that start when someone joins or is leaving. Settings › People holds
locations, cost centres, levels, leave policies, journey templates and profile fields. Four
new capabilities, org admins by default: Manage People settings, Run journeys, Manage time
off and Edit profiles. Schema: People's changesets 0001 to 0003 add people_levels,
leave_policies, leave_requests, journey_templates, journeys and journey_tasks. The kernel's
approval engine now finds a requester's manager and a cost centre's owner from the person
record, and the custom fields and person record changesets are renumbered 0801 and 0802.
