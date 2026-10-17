# Pipelines: What changed?

**Primary job.** Something broke: find the change that did it and undo it
(`/pipelines/releases/changes`, the second tab under Releases).

**What is on it.** The window (last hour, 3 hours, day, 7 days), Prod only, and which kinds of
change. The error rate over the window (SeriesChart, red line) with every deploy and config
change marked where it landed; one that landed just before the rise is amber, by timing alone,
and the rise is stated ("Up from 0.2% to 1.9% since 14:05"). Below, every change newest first:
when, kind, summary, detail, who, the "3 minutes before the rise" flag and Roll back on deploys.
One request (`GET /changes`), refreshed by the scope's map topic.

**Top three actions.**

| Action | Mouse | Keyboard | Touch |
| --- | --- | --- | --- |
| Narrow or widen the window | The window control | [ and ] | Tap the window control |
| Roll back a deploy | Roll back on its row, then confirm | J K to it, Shift+B | Tap the undo button |
| Read a change | The row | J K | Tap the row |

**States.** Chart and rows skeleton; no metrics source says the list is still complete; an
empty window suggests a longer one; a refused roll back shows the policy's sentence.

**URL state.** `?window=`, `?prod=1`, `?kinds=deploy,config`, and the scope.

**Choices recorded.** Roll back asks once (a Prod change cannot be undone with Undo) and keeps
an optional reason. Revert for config and environment changes is not offered: there is no
revert endpoint yet. The endpoint is not served yet; the screen is built against the contract.
