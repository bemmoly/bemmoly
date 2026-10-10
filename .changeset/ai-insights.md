---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/core-web': minor
'@bemmoly/ui': minor
'@bemmoly/api-client': minor
'@bemmoly/module-work': minor
'@bemmoly/module-docs': minor
'@bemmoly/web': minor
'@bemmoly/server': patch
---

AI now summarises your work where you read it. Every summary appears only while AI is on. Each
claim links to the issue, comment, section or page it came from. A claim without a source keeps
a visible "Unsourced" tag. Every card offers "Not useful".

- **Issue summary.** The issue page and slide-over say what the issue stands on, who it waits on
  and what it blocks. The summary reads the issue's fields, description, latest comments,
  changes since the last summary, blockers and the docs that link it.
- **Sprint risk.** The Board and the Backlog of a running sprint show one line naming the
  biggest risk, with its numbers. It refreshes five quiet minutes after the sprint changes. You
  can dismiss it.
- **Page TL;DR.** The card under a page's title is rewritten only when the page text changes.
- **Consistency checks.** These run when a page is published, and a minute after an issue it
  names changes. Contradictions between a paragraph and the issue show in the page's Linked
  work margin. The page also joins "Needs you" on the Docs home for its owner and reviewers.
- **Morning brief.** Home shows what changed in your projects and spaces since your last visit,
  yours first. It is written at 6 a.m. in your time zone and kept for the day.

Summaries are cached and rewritten only when what they read has changed. A failed one says so,
with Try again, and never blocks the page. With "Share content" off, only titles, keys, statuses
and field values are sent. Excluded spaces and projects are never sent. People who opted out
have their own writing kept out of summaries other people read. Settings › AI › Privacy now
lists Work's projects and Docs' spaces for exclusion.

There are no new settings or environment keys. The cache uses the `ai_insights` table from the
AI runtime's changesets. The new jobs are `ai.insight` and an hourly `ai.brief`.
