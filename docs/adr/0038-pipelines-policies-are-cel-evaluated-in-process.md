# ADR 0038: Pipelines policies are CEL, evaluated in process with cel-js

- Status: accepted
- Date: 2026-10-17
- Design: [architecture §10](../proposals/pipelines/architecture.html) (access and policy)

## Context

Pipelines decides protected actions (deploy, request a Prod promotion, approve, roll back,
change variables) from role bindings, the owning team and policies. Policies are written by
platform teams, stored in the database and optionally in a Git repository, and evaluated on
every protected action. They need a language that is side-effect free, bounded in time and
size, readable by the people who review a policy change, and checkable when a policy is
saved rather than when a deploy is refused at 3 a.m. Kubernetes (ValidatingAdmissionPolicy),
Envoy and Google Cloud IAM conditions use CEL for the same job, so platform engineers have
usually read it before.

Three maintained TypeScript implementations were checked (2026-10-16):

| Package | Version | Dependencies | Notes |
| --- | --- | --- | --- |
| `@marcbachmann/cel-js` | 8.0.0 (July 2026) | none | Environment API with declared variables, custom functions and type checking; parse limits (AST nodes, depth, list size); MIT |
| `@bufbuild/cel` | 0.6.1 | `@bufbuild/cel-spec`, `@bufbuild/re2` (WebAssembly), protobuf runtime | Conformance-tested against cel-spec; brings protobuf types we do not use |
| `cel-js` | 0.8.2 (July 2025) | chevrotain, ramda | Older, slower; its author points to `@marcbachmann/cel-js` |

## Decision

1. **Policies are CEL, evaluated with `@marcbachmann/cel-js`, pinned exactly**, only inside
   `modules/pipelines/server/src/services/access/cel.ts`. No other file imports it.
2. **One declared environment.** A policy can read `application` (key, name, tier as int,
   labels, lifecycle, runtime, domain, group, owner, has_owner), `env` (key, class,
   protected, region), `action`, `requester` (id, teams, roles) and `freeze` (active, name),
   and call `has_role(string)` (a role or any role that includes it: a Platform admin is a
   Maintainer) and `in_team(string)`. Undeclared names are type errors.
3. **Checked when saved, fail closed when run.** Creating or changing a policy type-checks
   `applies`, the requester rule and the deny-if rule, and parses the window; an error names
   the field and is a 400. At decision time an expression that cannot be evaluated never
   passes: a selector that errors applies, a requester rule that errors refuses, and a
   deny-if rule that errors refuses with "could not be checked right now".
4. **Bounded.** Parse limits are 500 AST nodes, depth 40, 100 list elements, 8 call
   arguments. CEL has no loops beyond its bounded macros and no I/O.
5. **Facts are resolved before evaluation.** On-call, freezes and the clock are loaded by
   the service and passed in; a policy never fetches anything.

## Consequences

- One small dependency with no transitive packages; no WebAssembly or protobuf runtime.
- The implementation covers "most of the CEL spec"; a policy that uses a feature it lacks is
  refused when saved, never silently misread. If conformance becomes a requirement (policies
  shared with Kubernetes, say), `@bufbuild/cel` is the replacement and only `cel.ts` changes.
- Ints are 64-bit (`bigint`) inside expressions: the service converts `tier` before
  evaluation, so `application.tier == 0` type-checks and compares as written.
