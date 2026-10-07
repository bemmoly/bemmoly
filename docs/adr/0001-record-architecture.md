# ADR 0001: The technical design is the architecture record

- Status: accepted
- Date: 2026-10-07

## Context

Lattice's architecture was settled before code was written, in one document:
[docs/tech-design.html](../tech-design.html). It covers the module system, stack, repository
layering, database and schema changelog, API, security, AI, deployment, configuration,
performance and quality gates, and the eight promises every decision is checked against.

Contributors (people and AI agents) need one place that says what is decided, and a cheap,
visible way to change a decision without the reasoning getting lost in pull request threads.

## Decision

1. `docs/tech-design.html` is the architecture record. Its decisions are settled. This ADR
   stands for every decision in it; they are not re-recorded one by one.
2. Any change to a decision in the tech design, and any new decision of the same weight, is a
   new ADR in this folder. The pull request that implements the change links the ADR.
3. When an ADR changes the tech design, the same pull request updates the document so it stays
   true, and names the ADR next to the changed section.
4. The design mocks in `docs/design/mocks` remain the pixel source of truth; a change to the
   theme or to a screen's design is an ADR, not a pull request comment.

## How to write an ADR

- File name: `NNNN-short-kebab-title.md`, numbered in sequence, never reused.
- Sections: **Context** (the forces and the question), **Decision** (what we will do, stated
  plainly), **Consequences** (what becomes easier or harder, what must change, what we gave up),
  and **Alternatives considered** when there were real ones.
- Header: status (`proposed`, `accepted`, `superseded by NNNN`), date, and links to the sections
  of the tech design it touches.
- Keep it short. One decision per record. An accepted ADR is not edited except to mark it
  superseded; changing your mind is a new ADR.

## Consequences

- Reviewers can reject a change that contradicts the tech design without an ADR, citing this
  record.
- The tech design must be kept current, which costs a little effort in each architectural pull
  request and saves rediscovery later.
