# ADR 0003: No server build step; Node runs the TypeScript sources

- Status: accepted
- Date: 2026-10-07
- Tech design: [§5 Stack decisions](../tech-design.html#stack), [§6 Repository](../tech-design.html#repo)

## Context

The server, the kernel and every module are TypeScript. Node 24 strips type annotations
natively, so `node src/server.ts` runs the sources as written. A compile step would add an
output folder per package, source maps to keep in sync, a watch process in development and a
place for "works in dev, broken in the build" bugs.

## Decision

1. Server-side packages (`apps/server`, `packages/core`, `packages/shared`, `modules/*`) have
   no build. Their `exports` point at `.ts` files and Node runs them directly, in development,
   in tests and in the image.
2. Sources stay inside what Node's type stripping supports: `erasableSyntaxOnly`,
   `verbatimModuleSyntax` and `allowImportingTsExtensions` are on in `tsconfig.base.json`, so
   enums, namespaces and parameter properties fail typechecking, and imports name `.ts` files.
3. `tsc --noEmit` is the only compiler run, as a check. The web app keeps its Vite build,
   because browsers need bundles.

## Consequences

- One less moving part: what runs in the image is what is in the repository, and stack traces
  point at real lines without source maps.
- Workspace packages must resolve to real paths outside `node_modules`, since Node does not
  strip types under `node_modules`; pnpm's symlinked workspace packages satisfy this.
- Startup parses TypeScript on each boot. The cost is small and measured by the startup budget.
- Syntax that needs a transform (decorators with metadata, `enum`) is unavailable. Plain
  objects and `as const` cover the same ground.
- Preloads such as the telemetry hook load the same way: `node --import <module>.ts`.

## Alternatives considered

- **tsc or a bundler emitting JavaScript.** Familiar, but doubles the artefacts and adds a
  failure mode without a benefit the image needs.
- **A loader such as a TypeScript runtime package.** An extra dependency doing what Node
  now does natively.
