import type { TeamShare } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { rankTeams } from './teams.tsx';

const team = (name: string, running: number, borrowing = false) =>
  ({
    team: { id: name, name },
    running,
    share: 10,
    weight: 1,
    borrowing,
    waitP95Seconds: null,
  }) as TeamShare;

describe('rankTeams', () => {
  it('puts borrowing teams first, then the busiest, then by name', () => {
    const ranked = rankTeams([
      team('Cart', 4),
      team('Ads', 4),
      team('Search', 2, true),
      team('Pay', 9),
    ]);
    expect(ranked.map((row) => row.team.name)).toEqual(['Search', 'Pay', 'Ads', 'Cart']);
  });
});
