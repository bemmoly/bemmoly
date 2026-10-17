import { describe, expect, it } from 'vitest';
import { emptyDispatchState, pickTeam, readDispatchState, type FairCandidate } from './fair.ts';

/** Seeded so a failing case can be replayed. */
function rng(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

function serve(candidates: FairCandidate[], rounds: number) {
  let state = emptyDispatchState();
  const served: Record<string, number> = {};
  for (let i = 0; i < rounds; i += 1) {
    const pick = pickTeam(state, candidates);
    if (!pick) throw new Error('nobody picked');
    state = pick.state;
    served[pick.team] = (served[pick.team] ?? 0) + 1;
  }
  return served;
}

describe('pickTeam', () => {
  it('gives busy teams slots in proportion to their weights', () => {
    const served = serve(
      [
        { team: 'a', weight: 3 },
        { team: 'b', weight: 1 },
        { team: 'c', weight: 2 },
      ],
      600,
    );
    expect(served).toEqual({ a: 300, b: 100, c: 200 });
  });

  it('holds the proportion for random weights and team counts (property)', () => {
    const random = rng(42);
    for (let trial = 0; trial < 200; trial += 1) {
      const count = 1 + Math.floor(random() * 6);
      const candidates = Array.from({ length: count }, (_, i) => ({
        team: `team-${i}`,
        weight: 1 + Math.floor(random() * 10),
      }));
      const total = candidates.reduce((sum, c) => sum + c.weight, 0);
      const rounds = total * 20;
      const served = serve(candidates, rounds);
      for (const candidate of candidates) {
        // Exact over whole cycles; within one quantum at any point.
        expect(Math.abs((served[candidate.team] ?? 0) - candidate.weight * 20)).toBeLessThanOrEqual(
          candidate.weight,
        );
      }
    }
  });

  it('lets a lone team borrow every slot and hands it back at once when another arrives', () => {
    let state = emptyDispatchState();
    for (let i = 0; i < 50; i += 1) {
      state = pickTeam(state, [{ team: 'a', weight: 1 }])!.state;
    }
    const both = [
      { team: 'a', weight: 1 },
      { team: 'b', weight: 1 },
    ];
    const next: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const pick = pickTeam(state, both)!;
      state = pick.state;
      next.push(pick.team);
    }
    expect(next.filter((team) => team === 'b')).toHaveLength(3);
    expect(next.slice(0, 2)).toContain('b');
  });

  it('never lets an idle team bank credit', () => {
    let state = emptyDispatchState();
    for (let i = 0; i < 20; i += 1) {
      state = pickTeam(state, [{ team: 'a', weight: 5 }])!.state;
    }
    state = pickTeam(state, [{ team: 'b', weight: 1 }])!.state;
    expect(Object.keys(state.deficits)).toEqual(['b']);
  });

  it('reads a damaged stored state as empty instead of failing', () => {
    expect(readDispatchState('nope')).toEqual(emptyDispatchState());
    expect(readDispatchState({ cursor: 3, deficits: { a: 'x', b: 2 } })).toEqual({
      cursor: null,
      deficits: { b: 2 },
    });
    expect(pickTeam(emptyDispatchState(), [])).toBeNull();
  });
});
