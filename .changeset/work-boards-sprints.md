---
'@bemmoly/module-work': patch
---

Work gains the server side of boards, sprints, the backlog, saved filters and metrics. A project
gets its board the first time it is opened, copied from the org default board scheme or built
from its workflow, and the board can be configured with columns mapped to statuses, WIP limits,
swimlanes by epic, assignee, priority, type or a query, quick filters, card fields and colour
rules. The board view returns every card grouped by column and lane in one request, narrowed by
an optional query. Scrum projects can plan, start and complete sprints, one active at a time;
completing a sprint moves unfinished work to the backlog or another sprint and records what was
committed and completed for the velocity report. The backlog lists sprints with their committed
points beside capacity, and issues can be dragged between sprints and the backlog. Filters can be
saved privately or shared with teams. Boards report velocity, the active sprint's burndown, cycle
time and throughput. Board and sprint changes appear in the audit log. No schema or configuration
change.
