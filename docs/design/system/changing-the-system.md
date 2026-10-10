# Changing the system

The system is settled, not frozen. It changes on purpose, in one pull request that moves the
rule, the code and the checks together, so this folder never describes something the code does
not do.

## What needs what

| Change                                                      | ADR | This folder | Story | Lint or test     |
| ----------------------------------------------------------- | --- | ----------- | ----- | ---------------- |
| A new token, or a changed token value or meaning            | yes | yes         | yes   | `tokens.test.ts` |
| A new colour family, type step, radius or elevation         | yes | yes         | yes   | `tokens.test.ts` |
| A new shared component                                      | no  | yes         | yes   | a unit test with `expectAccessible` |
| A new variant or prop on a shared component                 | no  | if it changes when to use it | yes | the component's test |
| A new icon in the set                                       | no  | no          | Icons story lists it | — |
| A change to the frame, layouts, brand block or logo rules   | yes | yes         | yes   | where possible   |
| A new interaction rule or global key                        | yes | yes         | —     | where possible   |
| A content rule                                              | no  | yes         | —     | where possible   |
| A one-screen choice the system is silent on                 | no  | no (record it in the screen's interaction notes) | — | — |

"Where possible" means: if a rule can be checked by a machine cheaply and reliably, add the
check in the same pull request (an ESLint rule in `tools/eslint-plugin` with a `RuleTester`
test and a wiring test in `config.test.js`, or a source rule in
`packages/ui/src/components/rules.test.ts`), and only if it passes on the current codebase.

## The steps

1. **Write the ADR** in `docs/adr/` (next number, the format in ADR 0001): context with
   evidence, the decision, consequences, alternatives. Link the screen or review that shows why.
2. **Change the code**: tokens in `packages/ui/src/tokens/*.ts` then
   `pnpm --filter @bemmoly/ui tokens:css`; components in `packages/ui/src/components`; icons in
   `packages/ui/src/icons`.
3. **Update this folder**: the section that states the rule, with real names and imports. Keep
   each file under about 300 lines; split by topic and update [README.md](README.md).
4. **Add or update the story** so the change can be seen in every preset, light and dark.
5. **Add the check** where possible (see above). Never weaken an existing rule to get green;
   a scoped exception needs a comment saying why and when it goes, and a line here.
6. **Migrate or record the callers.** Either move every call site in the same change, or list
   the remaining ones as debt in the relevant section here.

## Who decides

Proposals to change the theme or the system go through an ADR, not a drive-by pull request
(AGENTS.md §2). The owner approves changes to brand, colour families and the frame. Anyone may
add a component, variant or icon that follows the existing rules.

## Recorded exceptions and debt

Kept here so they are visible, owned and temporary:

- Docs' page title is 36px, above the scale (with #77); its property row uses 12.5px. The
  `bemmoly/no-literal-styles` size check is off for `modules/docs/web` until both move onto the
  scale or an ADR adds a display step.
- A few marks still use arbitrary radii (`rounded-[2px]`, `rounded-[3px]`) and tracking or
  weight values; new code uses `rounded-tick` and the scale.
- `StatusBadge`, `PageStatusPill` and the legacy pastel hue pairs remain where screens still use
  them; new UI does not.
- Menu rows are about 33px on touch, under the 44px target. The bulk bar scrolls sideways at
  390px.
- The Appearance page's live preview still draws the first release's board.
