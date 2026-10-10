---
'@bemmoly/editor': minor
'@bemmoly/module-docs': minor
'@bemmoly/web': patch
'@bemmoly/e2e': patch
---

AI works inside the Docs editor. All of it appears only while AI is on, you can edit the page,
the space is not excluded and you have not turned AI off for yourself. Nothing AI writes
reaches the page until you accept it, so people editing the page with you never see an
unaccepted suggestion.

- **Ghost text.** Pause at the end of a line and the fast model suggests how the sentence goes
  on. The suggestion shows in lilac after the caret. Press Tab to keep it or Esc to drop it;
  any other key drops it too. A suggestion that takes longer than 1.5 seconds is dropped
  without a message. You can turn ghost text off for yourself on this device with
  ··· › Ghost text suggestions.
- **/ai commands and Ask AI.** The / menu's AI group has Continue writing, Summarize open
  questions from comments, Create issues from this section, Summarize this section, Draft
  from heading, Improve writing, Make shorter, Fix spelling and grammar, Translate to English
  and Turn into a table. Ask AI on a selection offers the commands that rewrite it. The answer
  streams into a lilac card below the text, with Replace, Insert, Ask again, Discard and Not
  useful. Accepting it is one change, and one undo takes it back. If the model fails, the card
  says why in plain words, for example a spent budget, an excluded space or the provider's own
  error.
- **Suggest a fix.** An inline comment thread whose text is still on the page offers Suggest a
  fix. The proposed replacement appears in the thread, and Apply fix applies it to the live
  page. Apply fix still refuses honestly if someone has changed those words since.

New endpoints: `POST /api/v1/docs/pages/:pageId/completions`,
`POST /api/v1/docs/pages/:pageId/ai-writes` (NDJSON) and
`POST /api/v1/docs/comments/:commentId/suggest-fix`. Each command has its own prompt file, and
an admin can override any of them in Settings › AI › Prompts. No schema or configuration
changes.
