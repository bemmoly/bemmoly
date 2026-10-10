---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/server': minor
'@bemmoly/web': patch
---

Admins now hear when AI spending runs low. When this month's AI spend reaches 80% of the
budget set in Settings › AI › Usage, everyone who can configure AI gets an inbox notification
and an email, for example "AI has used 80% of this month's $50 budget. $41.20 is spent so far.
At 100%, standard and strong AI pause until 1 November." When it reaches 100% they hear again:
"Standard and strong AI are paused until 1 November or until the budget is raised. Fast AI
keeps working." Both link to Settings › AI › Usage. Each is sent once a month. The new
notification kind is "AI budget alerts" in Settings › Notifications; it emails at once by
default and can be moved to the digest, the inbox only or off.

The "Ask your docs" prompt is now a prompt file like the others (`retrieval.answer`, version 1),
so an admin can read and override it in Settings › AI › Prompts.

For contributors: every AI prompt now has golden checks, run by `pnpm eval` in CI against
recorded answers (no key and no network) and nightly against a live provider when the
repository has one configured. `docs/ai-evals.md` explains how to add a prompt, an eval and a
recording.

No schema or configuration changes.
