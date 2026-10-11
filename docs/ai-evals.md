# AI prompts, evals and recordings

How to add a prompt, hold it to golden checks, and record what a model answers. The design
is tech design §11 (11.2 for evals); the rules are AGENTS.md §2 (AI) and §7.

## Add a prompt

Every prompt a feature sends is a Markdown file, never a string in code, so an admin can
override it in Settings › AI › Prompts and the evals can target it.

1. Write the file: YAML frontmatter, then `# System`, then `# Prompt`.

   ```markdown
   ---
   id: work.issue_summary
   version: 1
   role: standard
   description: The AI summary card on the issue page.
   variables: [key, title, context]
   output_schema: issue_summary
   ---

   # System

   The stable rules (providers cache this part).

   # Prompt

   Summarise {{key}}: {{title}}

   {{context}}
   ```

   - `id` is lowercase and dot-namespaced. A module's ids start with its module id
     (`docs.`, `work.`); kernel ids start with `ai.` (`retrieval.answer` keeps the id its
     runs were first recorded under).
   - `role` is `fast`, `standard` or `strong`. `output_schema` names a zod schema when the
     answer is structured (the insight kinds in `@bemmoly/shared/ai-insights`), else `null`.
   - Every `{{variable}}` is listed in `variables`, and every listed one is used; boot fails
     otherwise. Volatile text (sources, the question) goes in `# Prompt`, never in `# System`.
   - Text a person or a page wrote is content to read, never instructions: say so in the
     system part when the prompt carries it.

2. Register it. A module calls `ctx.ai.addPromptFile({ name, path })` from its `register`.
   A kernel prompt is added to `KERNEL_PROMPT_FILES` in `apps/server/src/config/ai.ts`.

3. Call it through the facade, never with inline text:

   ```ts
   const prompt = await ctx.ai.renderPrompt('work.issue_summary', variables);
   await ctx.ai.generate({
     role: prompt.role,
     purpose: 'summary',
     system: prompt.system,
     prompt: prompt.prompt,
     promptRef: prompt.promptRef,
   });
   ```

   `promptRef` is recorded on `ai_runs`, so a run can be traced to the file and version.

4. Change a prompt's meaning, and its `version` goes up by one. Its recordings then fail the
   coverage eval until they are made again (below). A whitespace or typo fix keeps the version.

## Add an eval

Evals live in `apps/server/test/ai/` and run with `pnpm eval`:

| File                       | What it holds                                                         |
| -------------------------- | --------------------------------------------------------------------- |
| `fixture/acme.ts`          | The Acme Labs sample from the mocks: people, PLT, Sprint 14, the RFC  |
| `fixture/contexts.ts`      | Insight contexts written with the kernel's context writer             |
| `checks.ts`                | Golden checks: pure functions that return null or the reason it fails |
| `*.eval.ts`                | One file per area; each case calls the prompt as its feature does     |
| `index.ts`                 | The eval index: prompt id → eval file, cases and the checks they make |
| `recordings/<case>.json`   | What a model answered for one case, replayed in CI                    |

The fixture plants one conflict on purpose: the RFC's Rollback says sessions stay valid for
15 minutes, while PLT-204 and the runbook say 30. `docs.consistency` must find it.

To cover a new prompt:

1. Add a case to the eval file for its area (or a new `*.eval.ts`). Build its variables from
   the fixture, call it the way the feature does (same role, schema, tools and limits), then
   `save(prompt.promptRef, [replyOf(result)])` so record mode can write its recording.
2. Hold the output to the prompt's promises with checks from `checks.ts`, through `pass()`,
   so a failure reads as a sentence. A new check gets a line in `checks.eval.ts` showing
   that it fails a bad output.
3. Add the prompt to `index.ts`: its file, case ids and checks. A case that must never reach a
   model (for example "no sources") goes under `silent` and has no recording.

`coverage.eval.ts` fails when a prompt on the boot path has no entry in the index, when an
entry names a prompt that is gone, or when a recording was made against an older version.

## Make or refresh a recording

Recordings use the recorded provider's format (`BEMMOLY_AI_RECORDING`): one reply per model
call, in order, keyed by prompt id, plus the prompt id and version they answered. A plan's
recording lists the read tool calls, then the write calls it proposed.

Record against a live provider, with your own key in your shell, never in a file:

```sh
BEMMOLY_EVAL_LIVE=true BEMMOLY_EVAL_RECORD=true \
BEMMOLY_EVAL_PROVIDER=<models.dev provider id> BEMMOLY_EVAL_MODEL=<model id> \
BEMMOLY_EVAL_API_KEY=<key> \
pnpm --filter @bemmoly/server exec vitest run --config vitest.eval.config.ts test/ai/insights.eval.ts
```

- Name a file or a test (`-t "docs.consistency"`) to refresh only what changed.
- Cloud providers that need more than a key take `BEMMOLY_EVAL_CREDENTIALS`, a JSON object
  keyed by the catalog's env names. `BEMMOLY_EVAL_BASE_URL` points at a gateway or a local
  model server.
- A recording is written only when the live answer passes its checks; read the diff before
  committing it, and check no key, email or personal data is in it.
- You can also write a recording by hand, for example to pin an edge case the model rarely
  produces. It must still pass the checks.

Without `BEMMOLY_EVAL_RECORD`, `BEMMOLY_EVAL_LIVE=true` runs the evals against the provider
and writes nothing: that is what the nightly workflow does.

## Where they run

- **Fast checks** (`ci.yml`): `pnpm eval` against the recordings. No key, no network.
- **AI evals** (`ai-evals.yml`, 03:00 UTC and on demand): the same evals against a live
  model. It needs the `BEMMOLY_EVAL_API_KEY` secret (or `BEMMOLY_EVAL_CREDENTIALS`) and the
  `BEMMOLY_EVAL_PROVIDER` and `BEMMOLY_EVAL_MODEL` repository variables; without them it
  skips with a notice. A failure opens or updates an issue.
