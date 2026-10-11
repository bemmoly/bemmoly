# ADR 0018: AI code a lazy screen needs sits behind its own subpath export

- Status: accepted
- Date: 2026-10-11
- Tech design: [§20 Performance](../tech-design.html#performance) (initial JS under 250 KB),
  [§6 Repository](../tech-design.html#repo)

## Context

The web shell's initial JavaScript has a 250 KB gzip budget, checked by size-limit in CI
against every script `index.html` loads. The shell imports the barrels of `@bemmoly/shared`,
`@bemmoly/api-client`, `@bemmoly/ui` and `@bemmoly/core-web`, and the bundler keeps whatever
a barrel pulls in unless it can prove the module free of side effects. A zod schema is built
when its module loads, so `@bemmoly/shared` cannot honestly say it has none, and before 0.5
`@bemmoly/ui` did not say so either.

AI adds a lot of code that only some screens use: answer and insight schemas, the citation
reader, the streamed answer client, the answer and insight cards. Exported from the barrels,
all of it rode in the first load of every workspace, including the ones that never turn AI on.

## Decision

1. AI code that only lazy screens need is exported from a subpath of its package, never from
   the package barrel:
   - `@bemmoly/shared/ai-answers` and `@bemmoly/shared/ai-insights` (schemas, citation reader);
   - `@bemmoly/api-client/ai-answers` and `@bemmoly/api-client/ai-insights` (endpoints);
   - `@bemmoly/ui/ai-answer` and `@bemmoly/ui/ai-insight-body` (components);
   - `@bemmoly/core-web/ai-insights` (the insight hook and card).
2. A barrel keeps only what the shell itself needs while AI is off or on: AI status and
   settings contracts, insight kinds and the realtime event names used for routing, run
   feedback (`api.ai.runs.feedback`) and the small AI parts every card shares.
3. `@bemmoly/ui` declares `"sideEffects": ["**/*.css"]`, so a component re-exported by its
   barrel but used only by lazy screens loads with those screens.
4. A new AI surface follows the same rule: its contracts, client and component go behind a
   subpath when the shell does not render them.

## Consequences

- The shell's first load dropped by about 23 KB gzip for the `sideEffects` flag and a further
  amount for each subpath; a workspace with AI off downloads no answer or insight code until a
  screen that draws one opens.
- Importers must know which entry point holds a symbol. The subpaths are listed in each
  package's `exports`, and a symbol missing from the barrel fails typecheck, not at runtime.
- A schema that moves behind a subpath stays one schema: server and client import the same
  module, so the contract cannot drift.

## Alternatives considered

- **Mark `@bemmoly/shared` side-effect free.** Untrue for modules that build schemas at load,
  and a wrong flag silently drops code that registers itself.
- **Raise the budget.** Every workspace would pay for AI it may never enable, against the
  promise that AI off changes nothing.
- **Separate AI packages.** More `package.json` files, versions and lint configs for what a
  subpath export already gives.
