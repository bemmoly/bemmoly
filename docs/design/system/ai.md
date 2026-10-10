# AI surfaces

AI is optional, honest and visibly AI. Lilac marks it, and nothing appears while it is off.

## Rules

1. **Lilac means AI, and only AI.** The logo's `#9A85EA` (`brand-3`) is the AI colour. In UI it
   is the `ai` tokens:

   | Token    | Use                                   |
   | -------- | ------------------------------------- |
   | `ai`     | Marks and fills: the AI dot, icons    |
   | `ai-600` | AI text (4.5:1 on `ai-50`)            |
   | `ai-100` | Borders of AI cards                   |
   | `ai-50`  | Backgrounds of AI cards               |

   Never use them for a brand flourish, a "new" badge, a module colour or an epic. Epics are
   `type-epic` violet `#6E56CF`, a different hue on purpose.

2. **Only when AI is on.** Every AI surface renders only when the workspace has AI on
   (`aiEnabled` on the workspace settings, `useWorkspace().aiEnabled` in `apps/web`, passed to
   modules by their host). With AI off:
   - no AI button, menu group, palette line, card or empty-state suggestion is drawn;
   - stored AI output (a summary, a suggestion) stays unshown, not greyed;
   - nothing says "Upgrade" or "Get AI": AI is turned on by an admin in Settings › AI, and only
     admins are told where.

3. **Use the AI components.** From `@bemmoly/ui` · Story: Components/AI surfaces
   ([`ai-surface.stories.tsx`](../../../packages/ui/src/components/ai-surface/ai-surface.stories.tsx)):
   `AiSummary` (a TL;DR card), `AiInsightBar`, `AiBrief`, `AiSuggestion` (a proposed change with
   Apply), `AiAnswer` (a cited answer), `AiActionButton`, `AiAskButton` (Ask AI, with its shortcut), `AiDot`, `AiNotUseful`.
   Toasts about AI output use `tone="ai"`. Inside `packages/ui`, the AI tokens are allowed only in
   `ai-surface/`, `command-palette/` and `toast/` (`rules.test.ts` fails anything else).

4. **AI suggests; a person applies.** AI output is shown as a suggestion with its source and an
   explicit action (Apply, Insert, Ask again). Nothing AI produces is saved, sent or published
   without a person choosing to. Every AI card offers "Not useful".

5. **Say where it came from.** AI text is labelled as AI (the dot and lilac, plus words where
   space allows: "Summary by AI"), names its source when it has one, and never poses as a person.

6. **AI never blocks.** A slow or failing model shows its own state inside its card (a skeleton,
   then "Couldn't get a summary" with Try again); the page around it works without it.

7. **Answers cite.** A generated answer uses `AiAnswer`: each sentence ends with numbered
   citation links that open the source at its place (a page heading, an issue), a factual
   sentence without one carries a neutral "Unsourced" tag, and the cited places are listed
   under it once it finishes. When nothing in the workspace answers, say so plainly; never
   guess.

## Where AI appears today

- The palette: the AI line and the plan preview (`CommandPlan`), in lilac, only with AI on.
- Docs (with #77): the TL;DR card, a comment's suggested fix with Apply fix, the / menu's AI
  group, Ask AI in the selection bubble.
- Docs home: "Ask your docs", the question box with a streamed `AiAnswer` under it, only with
  AI on and an embedding model set.
- The marketing site: one lilac "coming, optional" band, no picture until a real screen exists
  ([marketing-site.md](marketing-site.md)).

## Checks

- Turn AI off in the demo seed; no lilac pixel remains on any screen.
- `grep -rn "ai-50\|ai-100\|ai-600\|text-ai\|bg-ai"` in the diff: every hit is AI output.
- Tests cover each new AI surface with AI off.
