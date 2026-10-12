---
'@bemmoly/module-work': minor
---

An issue can have several assignees. `PUT /api/v1/work/issues/:key/assignees` sets the whole
list (the first is the primary) and the issue page payload carries `assignees`. Work changeset
`0030-work-issue-assignees` copies every current assignee across; the single `assigneeId` keeps
working as the primary assignee.

A new Pairing view on each project (`G P`) shows who was assigned to issues at the same time as
whom over the last 30 days, 90 days or year: a matrix of shared-issue counts, and for each pair
their issues together, hours together and when they last paired. LQL gains `pairedWith`, and
`assignee` now matches anyone on an issue.

With `work.pairing.suggestions` turned on (off by default), the Pairing view also suggests next
pairs: people who never paired first, then the pairs that paired least and longest ago.
