# Content and voice

Words are interface. Bemmoly speaks plainly, calmly and to the point, in the second person, like
a capable colleague.

## Rules

- **Sentence case everywhere**: titles, buttons, tabs, menu items, column names, badges, group
  labels, settings sections. "Create issue", not "Create Issue". Product and module names keep
  their capital (Bemmoly, Work, Docs).
- **No capitalised labels.** No `uppercase` class, no ALL CAPS chips, section headings or status
  pills in new UI. Small headings are 11px semibold `tx-3`, the sidebar section style.
- **Verbs on buttons**, naming the outcome: "Create issue", "Save changes", "Invite people",
  "Restore backup". Never "Submit", "OK", "Yes", "Confirm" or "Go".
- **Destructive buttons say what goes**: "Delete issue", "Move to trash", not "Delete" alone when
  the object is not on screen.
- **"…" when more input follows**: a menu item or button that opens a dialog to finish the job
  ends with an ellipsis ("Move to…", "Restore…"). One that acts at once does not.
- **Errors say what happened and what to do next**, in plain words, and say when nothing was
  lost: "Couldn't save the title. Check your connection and try again." Never "Oops", "Something
  went wrong" alone, a status code alone, or blame ("You entered an invalid value"). Server
  failures add the request id in small text.
- **Validation sits under its field** and says what is accepted: "Use letters, numbers and
  dashes".
- **Empty states**: the title says what is not here yet, the line says how it gets here, one
  action does it ("No issues in this sprint" / "Plan issues from the backlog" / "Open backlog").
- **No jargon or internal names**: no table names, module ids, capability strings, "LQL" outside
  the query bar, or stream and milestone names. Prefer "people" to "users" in headings and prose.
- **Numbers and time**: tabular figures; "9 of 48 points", "All · 8" for segment counts;
  relative times through `RelativeTime` ("3h ago"), absolute on hover.
- **Keys in words** in text ("the arrow keys", "the palette"); drawn with `Kbd` where shown.
- **Tone**: no exclamation marks, no emoji in product chrome (people's own content may have
  them), no marketing in the product. Delight is earned by behaviour, not adjectives.

## Words we use

| Use                    | Not                            | Why                                            |
| ---------------------- | ------------------------------ | ---------------------------------------------- |
| Sign in, Sign out      | Log in, Login, Logout          | One pair, everywhere                           |
| Workspace              | Organisation, tenant, instance | One workspace per install                      |
| People                 | Users (in headings and prose)  | Plain; Settings groups it as People            |
| Delete (with Undo)     | Remove, when it is gone        | Delete is gone from the product                |
| Remove                 | Delete, when it stays          | Remove takes it off something (a label, a member from a team) |
| Move to trash          | Delete, for pages              | Docs pages go to the trash first               |
| Turn on, Turn off      | Enable, Disable (in prose)     | Settings › Modules keeps "Enable" on its button |
| Try again              | Retry (in full-size errors)    | "Retry" only in tight rows                     |

## Other products' names

- **Competitor and vendor names appear only as import or source labels**: "Import from Jira",
  "Import from Confluence". Never in comparisons, marketing claims, empty states, tooltips or
  placeholder text, and never as a product's logo outside its import card.
- AI providers and models come from the models.dev catalog at run time; no file names a vendor
  (AGENTS.md, AI). The UI shows the catalog's names as data.
- Sign-in providers show their own mark on their own button (Google's "G") because the provider
  requires it; nothing else borrows a brand.

## Checks

- Search the diff for `uppercase`, `Submit`, `OK<`, `!"` and `Oops`.
- Read every new string aloud: would a calm colleague say it?
- Every error string answers "what now?".
