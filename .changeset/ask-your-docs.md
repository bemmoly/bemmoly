---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/api-client': minor
'@bemmoly/ui': minor
'@bemmoly/module-docs': minor
'@bemmoly/module-work': minor
'@bemmoly/web': patch
'@bemmoly/server': patch
---

Ask your docs. With AI on and an embedding model set, the Docs home has a question box. Its
answer streams in with numbered citations that open the page at the heading, or the issue,
they came from.

- **Only what you can open.** Answers draw on pages by heading and on issues (description and
  each comment), but only from the spaces and projects you can open. Every record is checked
  again with the same rules the rest of the app uses.
- **Honest answers.** A factual sentence with no source is marked "Unsourced". When nothing in
  your workspace answers the question, the box says so instead of guessing.
- **Every state handled.** A provider that is down, a spent budget and models that aren't set up
  each get plain words. Only admins are told where to change AI. "Not useful" marks the answer.
  With AI off the box is not drawn.
- **Search.** Answers combine meaning-based search over the embeddings with the existing
  keyword search.

For admins:

- **Indexing.** It runs as background jobs. They follow edits a few seconds after they settle,
  re-embed only the sections that changed, and run a full backfill when AI is turned on or the
  embedding model changes. A backfill waits while the month's budget is spent.
- **What is never embedded.** Excluded spaces and projects, content from people who opted out,
  and everything while "Share content" is off. Chunks already stored are removed when one of
  these settings changes, and a safety sweep runs every 15 minutes.
- **No new configuration.** Answers use the standard role and the index uses the embedding
  role, both from Settings › AI.

For developers: modules offer content with `ctx.ai.addRetrievalSource`. The API is
`POST /api/v1/ai/answers` (NDJSON). Its contract lives at `@bemmoly/shared/ai-answers` and its
client at `@bemmoly/api-client/ai-answers`, and the `AiAnswer` card is at
`@bemmoly/ui/ai-answer`.
