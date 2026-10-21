import { describe, expect, it } from 'vitest';
import { IDS, roadmapView } from '../roadmap/fixtures.test-helper.ts';
import { programSummary } from './program-summary.ts';

/* A program's header numbers, from the roadmap fixture. */

describe('program summary', () => {
  it('counts epics, the ones slipping worst first, and conflicting dependencies', () => {
    const view = roadmapView();
    const [first] = view.dependencies;
    const summary = programSummary({
      ...view,
      dependencies: first ? [{ ...first, conflict: true }] : [],
    });
    expect(summary.epics).toBe(view.items.filter((item) => item.kind === 'epic').length);
    expect(summary.atRisk[0]?.id).toBe(IDS.billing);
    expect(summary.conflicts).toBe(1);
  });

  it('counts dependencies that cross projects', () => {
    const view = roadmapView();
    const mobile = view.items.find((item) => item.projectId === IDS.mob);
    const summary = programSummary({
      ...view,
      dependencies: mobile
        ? [
            {
              id: IDS.billing,
              fromId: IDS.billing,
              toId: mobile.id,
              via: 'issue',
              links: 2,
              conflict: false,
            },
          ]
        : [],
    });
    expect(summary.acrossTeams).toBe(mobile ? 1 : 0);
    expect(summary.conflicts).toBe(0);
  });
});
