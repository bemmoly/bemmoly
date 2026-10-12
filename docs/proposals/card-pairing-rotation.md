# Proposal: multiple assignees, card pairing and rotation matrix (Work module)

## Problem
A Work card has exactly one owner today (`issues.assignee_id`, `modules/work/changelog/0006-work-issues.ts:30`).
Teams that pair or mob can't record who actually worked a card, and nobody can see whether
pairing is spreading knowledge or the same two people always pair.

## Scope
1. **Multiple assignees** — a card can have 0..n assignees.
2. **Pairing history** — every pair of co-assignees on a card is recorded as a pairing, with
   time on the card together.
3. **Rotation matrix** — a person × person grid per team/board showing pairing counts (and
   recency), with stale pairs highlighted and an optional "suggest next pairs" action.

## Data model
- New table `issue_assignees (issue_id, user_id, role text NULL, added_at, removed_at NULL)`,
  PK `(issue_id, user_id, added_at)`; partial index on active rows.
- Migration: backfill from `issues.assignee_id`; keep the column as the **primary assignee**
  for one release (read-compat for LQL, automations, card view), then drop.
- Pairings are derived, not stored: overlapping active intervals of two assignees on the same
  issue = one pairing, weighted by overlap duration. Materialize into
  `pairing_stats (team_id, user_a, user_b, count, overlap_seconds, last_paired_at)` if the
  query proves slow (user_a < user_b to keep it symmetric).

## API / query language
- Issue payload: `assignees: User[]` (+ `assignee` kept as primary during the compat window).
- LQL: `assignee = me` matches any assignee; add `assignees.count`, `paired_with = @user`.
- Automations: "when assignee added/removed" triggers; "assign to" action accepts several users.
- New endpoint: `GET /work/teams/:id/pairing-matrix?from&to` → users, cells
  `{a, b, count, overlapSeconds, lastPairedAt}`, and optional `suggestions` (greedy matching
  that minimises recent pair counts among currently available members).

## UI (follow `docs/design/system/README.md`)
- Card: stacked avatars (max 3 + "+n"); assignee picker becomes multi-select.
- Board filters / lanes: swimlane by assignee places a card in each assignee's lane (or the
  primary only — needs a decision).
- New "Pairing" view on the team: heat-map matrix, legend, date range, click a cell to list the
  shared cards, "Suggest pairs" button.

## Open questions
- Should lanes duplicate multi-assignee cards or use the primary?
- Do mobs (3+) count as every pairwise combination, or a separate "mob" stat?
- Is the matrix visible to all members or only team leads?
- Suggestions: past-only for v1, or ship suggestions too?

## Rollout
1. Schema + backfill + API compat. 2. Multi-select UI & LQL/automation updates.
3. Pairing derivation + matrix view. 4. Suggestions (behind a flag).
Changelog entries per AGENTS.md; tests for migration backfill, LQL, card-view, matrix query.
