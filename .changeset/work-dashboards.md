---
'@bemmoly/module-work': minor
'@bemmoly/web': minor
---

Projects have Dashboards (`G D`): your own grids of the project's reports. A new dashboard
starts with the project's usual reports (burndown, burnup, velocity, cumulative flow and the
quarter for Scrum; flow, control chart and time in status for Kanban). Add a report from Add
report, drag a report by its grip (or press the arrow keys on it) to reorder, and use its menu
to make it full width or remove it. Dashboards are private to the person who made them and
are saved on the server.

Projects also have a Quarter view (`G Q`) for teams that plan by the quarter: completed work
against the share of the quarter gone, a weekly burnup, the quarter's sprints and its epics'
progress. It is also a dashboard report.

A dashboard can hold a pinned report: a saved report spec that other features (the assistant,
next) add through `POST /api/v1/work/dashboards/:id/widgets`.

Schema: one changeset (0035) creates `dashboards` with its indexes. It is fast and reversible.
