---
'@bemmoly/core': patch
---

Deleting a project, a Docs space or a page now removes everything that pointed at it: comments
(with their reactions), attachments, watchers, links and mentions, notifications, and search
embeddings and AI insights. Before, these rows stayed behind with nothing to show them. A project
with more than 5,000 issues disappears at once and its issues are deleted in batches in the
background.

Schema: the update adds delete triggers and indexes (Work 0032, Docs 0019, kernel 0703; these are
marked slow on a large workspace) and removes rows left by earlier deletes in committed batches
(Work 0033, Docs 0020, not transactional). `bemmoly doctor` and Settings > System gain a "Data
integrity" check that reports any orphaned rows.
