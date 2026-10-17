/*
 * Weighted deficit round robin (architecture §5.2), one step at a time: each claim asks which
 * team's job goes next. Teams take turns in a fixed ring; a team's turn grants it its weight
 * in credit, and each job served costs one. Over time each busy team gets slots in
 * proportion to its weight. A team with nothing waiting loses its credit, so nobody banks a
 * share while idle, and when only one team has work it takes every slot (idle share is
 * borrowed and handed back at the very next dispatch, never by stopping a running job).
 */

export interface DispatchState {
  /** The team whose turn it is. */
  cursor: string | null;
  deficits: Record<string, number>;
}

export interface FairCandidate {
  /** A team id, or "none" for jobs no team owns. */
  team: string;
  weight: number;
}

export const NO_TEAM = 'none';

export function emptyDispatchState(): DispatchState {
  return { cursor: null, deficits: {} };
}

/** Reads the stored state defensively: an older or hand-edited row must not stop dispatch. */
export function readDispatchState(raw: unknown): DispatchState {
  if (typeof raw !== 'object' || raw === null) return emptyDispatchState();
  const value = raw as { cursor?: unknown; deficits?: unknown };
  const deficits: Record<string, number> = {};
  if (typeof value.deficits === 'object' && value.deficits !== null) {
    for (const [team, deficit] of Object.entries(value.deficits)) {
      if (typeof deficit === 'number' && Number.isFinite(deficit)) deficits[team] = deficit;
    }
  }
  return { cursor: typeof value.cursor === 'string' ? value.cursor : null, deficits };
}

/**
 * Picks the team to serve among those with work waiting, and the state after serving it.
 * Candidates may come in any order; the ring is ordered by team id so every replica agrees.
 */
export function pickTeam(
  state: DispatchState,
  candidates: readonly FairCandidate[],
): { team: string; state: DispatchState } | null {
  if (candidates.length === 0) return null;
  const ring = [...candidates].sort((a, b) => (a.team < b.team ? -1 : a.team > b.team ? 1 : 0));
  const deficits: Record<string, number> = {};
  for (const { team } of ring) deficits[team] = state.deficits[team] ?? 0;
  let index = state.cursor ? ring.findIndex((candidate) => candidate.team === state.cursor) : -1;
  if (index === -1) {
    // The team whose turn it was has nothing waiting: the turn passes to the next in the ring.
    const after = state.cursor ? ring.findIndex((candidate) => candidate.team > state.cursor!) : 0;
    index = after === -1 ? 0 : after;
    const first = ring[index]!;
    deficits[first.team] = (deficits[first.team] ?? 0) + first.weight;
  }
  for (let step = 0; step <= ring.length * 2; step += 1) {
    const current = ring[index]!;
    if ((deficits[current.team] ?? 0) >= 1) {
      deficits[current.team] = (deficits[current.team] ?? 0) - 1;
      return { team: current.team, state: { cursor: current.team, deficits } };
    }
    index = (index + 1) % ring.length;
    const next = ring[index]!;
    deficits[next.team] = (deficits[next.team] ?? 0) + next.weight;
  }
  // Unreachable with weights of at least one; serve the cursor's team rather than nobody.
  const fallback = ring[index]!;
  return { team: fallback.team, state: { cursor: fallback.team, deficits } };
}
