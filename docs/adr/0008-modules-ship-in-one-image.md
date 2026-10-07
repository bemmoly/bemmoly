# ADR 0008: Every module ships in the one image and is enabled per install

- Status: accepted
- Date: 2026-10-07
- Tech design: [§4 Modules](../tech-design.html#modules), [§18 Deploy](../tech-design.html#deploy), [§25 Open decisions](../tech-design.html#decisions)

## Context

People want to install only what they use: Docs without Work, or Work without Docs. That can be
done by downloading module code at runtime, or by shipping every module and enabling some.
Downloading needs a version-compatibility matrix, signature checks, a plugin loader, a sandbox
for third-party code and a second update path, all before 1.0.

## Decision

1. The application image contains the kernel and every first-party module. An install enables
   modules in the setup wizard or Settings, or pins them with `BEMMOLY_MODULES`.
2. A disabled module registers nothing: no routes, navigation, jobs or capabilities, and its
   schema changesets do not run until it is enabled.
3. One release version covers the kernel and every module; one update moves them together.
4. The module contract (`defineModule`, the registries, the changelog) is written so that
   separately distributed modules remain possible later without changing modules.

## Consequences

- One artefact to build, sign, scan and test, and one update flow. The install-only-Docs
  experience exists from the first release.
- The image carries code an install may never enable. The cost is disk, not memory or
  schema, since disabled modules do not load.
- No third-party code runs in the process; marketplace modules are out of scope until a
  sandbox exists.
- A module cannot be updated on its own; fixes ship as product patch releases.

## Alternatives considered

- **Downloadable modules.** The flexible end state, but it needs signing, a compatibility
  matrix and a plugin sandbox first. Recorded as later scope.
