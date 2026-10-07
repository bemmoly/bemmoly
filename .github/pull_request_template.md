<!--
The title becomes the squash commit: Conventional Commits, imperative, lowercase subject,
at most 72 characters, no issue numbers (AGENTS.md §4 and §5). Keep it under ~400 lines.
-->

## What

<!-- The change in a few sentences. -->

## Why

<!-- The reason. Link the issue in the body as "Closes #123"; name the ADR if one applies. -->

## How it was tested

<!-- Commands you ran and what they showed. A red test is reported as red. -->

- [ ] `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`
- [ ] `pnpm test:integration` (anything touching the database, queue, realtime or search)
- [ ] `pnpm build && pnpm size && pnpm test:e2e` (new user flows have a Playwright test)

## Screenshots (UI changes)

<!--
Verified in a running browser. Put the screenshot beside the matching mock from
docs/design/mocks, per theme where it differs. Delete this section if there is no UI.
-->

| Mock | This change |
| ---- | ----------- |
|      |             |

## Checklist

- [ ] A `.changeset/` entry for user-visible changes (`pnpm changeset`), naming any schema or
      configuration change an admin should know about
- [ ] Schema changesets written, with `down` where reversible, `irreversible` or `slow` set
      where true, and compatible with the previous minor
- [ ] `apps/server/.env.example` updated for any new environment key
- [ ] Docs updated where behaviour changed; an ADR when a design decision changed
- [ ] No secrets in the diff; no rule in AGENTS.md or the lint config weakened
