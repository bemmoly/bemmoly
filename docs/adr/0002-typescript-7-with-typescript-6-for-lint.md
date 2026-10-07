# ADR 0002: TypeScript 7 typechecks; TypeScript 6 serves typescript-eslint

- Status: accepted
- Date: 2026-10-07
- Tech design: [§5 Stack decisions](../tech-design.html#stack) (Runtime row)

## Context

The tech design picks TypeScript 7, the Go-native compiler, so typechecking the whole
monorepo stays fast in CI. TypeScript 7 ships `tsc` but no JavaScript compiler API yet.
typescript-eslint, which runs the layering, boundary and type-aware rules, needs that API and
declares `typescript` as a peer dependency. With only TypeScript 7 installed, linting fails.

## Decision

1. `typescript@7` is the workspace's TypeScript. Every `typecheck` script runs its `tsc`.
2. `.pnpmfile.cjs` rewrites the packages that need the compiler API (`typescript-eslint`,
   `@typescript-eslint/*`, `ts-api-utils`) at install time: their `typescript` peer becomes a
   dependency on the TypeScript team's side-by-side package `@typescript/typescript6`.
3. Nothing else in the repository imports `typescript` as a library. Code that needs the
   compiler API waits for TypeScript 7's API or goes through typescript-eslint.

## Consequences

- Typechecking uses the fast compiler; ESLint keeps working with full type information.
- Two TypeScript versions are installed. A type that TypeScript 6 and 7 disagree on can
  pass `tsc` and confuse a type-aware lint rule; when that happens, `tsc` is authoritative.
- `.pnpmfile.cjs` is in Turborepo's global dependencies, so editing it invalidates caches.
- When TypeScript 7 ships its API and typescript-eslint supports it, the hook is deleted in
  one change and this ADR is superseded.

## Alternatives considered

- **Stay on TypeScript 6 everywhere.** Works today, but gives up the CI speed the stack
  decision was made for.
- **Run ESLint without type information.** Loses rules that depend on types and keeps the
  problem for any future type-aware rule.
- **Overrides in `package.json`.** pnpm overrides replace a version everywhere; they cannot
  give one consumer a different TypeScript than the rest of the workspace.
