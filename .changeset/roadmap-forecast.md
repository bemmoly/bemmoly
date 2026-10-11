---
'@bemmoly/module-work': minor
'@bemmoly/ui': minor
'@bemmoly/web': minor
---

Work has a roadmap. Open it beside a project's Board and Backlog (G R), or for every project from
the Work section. Epics and versions sit on a timeline you can zoom by weeks, months or quarters
and group by project or team, with their progress, what waits on what, and a forecast of when
each lands. Drag a bar, or use the arrow keys on it, to move its dates; Undo puts them back.

The forecast comes from your team's own pace (points per sprint when the project runs estimated
sprints, issues finished a week otherwise), shown as a likely date and a range with how sure it
is, and explained in plain words. With too little history it says so instead of guessing. It is
plain arithmetic: no AI is involved and nothing is sent anywhere.

Issues and versions gain an optional start date (set it on the issue page, or by moving a bar).
`GET /api/v1/work/roadmap` serves the roadmap; the issue and version PATCHes accept `startAt`.
Schema change: changeset `0025-work-start-dates` adds a nullable `start_at` date to `issues` and
`versions`; it is quick, additive and reversible.
