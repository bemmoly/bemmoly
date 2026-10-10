# ADR 0016: One written design system is the canonical rulebook for UI

- Status: accepted
- Date: 2026-10-10
- Supersedes: [ADR 0015](0015-premium-visual-system.md) decision 1 in part (the review stops
  being the place rules are read from; it becomes evidence)
- Tech design: [§6 Repository](../tech-design.html#repo) (`packages/ui`)

## Context

ADR 0015 made the design review the source of truth for the shell and the visual language, and
the redesign of Work, Settings, setup (0.4.0) and Docs (pull request #77) followed it. By then
the design knowledge lived in seven places: the review's `kit.css` and `content.js`, the
per-screen interaction notes, the Docs review, a build brief outside the repository (the agreed
decisions and twelve interaction principles), `packages/ui` and its stories, one lint rule, the
first release's mocks, and a marketing-site review. A contributor building a new screen had to
read all of them and reconcile them, and `AGENTS.md` and `CLAUDE.md` still pointed at the mocks
as the pixel source of truth. Each new screen risked inventing its values again, which is how
the first release grew nineteen font sizes.

## Decision

1. **`docs/design/system/` is the canonical design system.** It states, in short checkable
   rules with real token names and imports: principles, brand, tokens, layout, components,
   iconography, interaction, content and voice, AI surfaces, accessibility, the marketing site,
   a definition of done for UI, and how to change the system.
2. **`packages/ui` holds the values and the parts.** The folder names them; the code defines
   them. When they disagree, the pull request that notices makes them agree.
3. **The review, the interaction notes, the Docs review and the mocks become history and
   evidence**, linked from the system's README. The mocks are marked superseded wherever the
   system or the review covers a screen.
4. **`AGENTS.md` carries one design rule**: follow the system. Its older "Design fidelity"
   paragraph is replaced.
5. **Rules are enforced by machines where that is cheap and reliable**: the glyph-character
   ban (ADR 0015), a ban on literal colours and literal font sizes in UI code
   (`bemmoly/no-literal-styles`), a ban on importing Lucide outside the icon set, and a UI
   checklist in the pull request template.
6. **The system changes through an ADR**, an update to the folder, a story, and a lint rule or
   test where possible ([changing-the-system.md](../design/system/changing-the-system.md)).

## Consequences

- New screens start from one README and a ten-line checklist instead of seven sources.
- The size check of `bemmoly/no-literal-styles` is off for `modules/docs/web` until the Docs
  page title (36px) and property row (12.5px) from #77 move onto the type scale or an ADR adds a
  display step; the exception is listed in the system.
- Interaction notes per screen still live in `docs/design/premium/interaction/`; the system
  requires them for every new screen.
- The review's build tooling and drawings stay in the repository, unchanged, as evidence.

## Alternatives considered

- **Keep the review as the source of truth.** It is a comparison of two designs, not a
  rulebook; it cannot say "never" or name an import, and it does not cover content, AI or the
  marketing site.
- **Document the system in Storybook only.** Storybook shows components well but cannot hold
  rules about layout, words or process, and is not where an agent reading `AGENTS.md` looks.
- **One long file.** Easier to find, harder to keep current; files split by topic stay under
  about 300 lines, like the code.
