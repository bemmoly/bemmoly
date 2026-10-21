import type { RoadmapItem, RoadmapView } from '@bemmoly/module-work/shared';

/*
 * What a program's header says, from its roadmap view: epics done, the epics at risk or late
 * (worst first), the dependencies whose dates conflict, and those that cross teams. Pure, so
 * it is tested without a screen.
 */

export interface ProgramSummary {
  epics: number;
  done: number;
  atRisk: RoadmapItem[];
  conflicts: number;
  acrossTeams: number;
}

const SLIP: Record<string, number> = { late: 0, at_risk: 1 };

export function programSummary(view: RoadmapView): ProgramSummary {
  const epics = view.items.filter((item) => item.kind === 'epic');
  const atRisk = epics
    .filter((item) => item.forecast.state === 'late' || item.forecast.state === 'at_risk')
    .sort(
      (a, b) =>
        (SLIP[a.forecast.state] ?? 2) - (SLIP[b.forecast.state] ?? 2) ||
        (b.forecast.daysLate ?? 0) - (a.forecast.daysLate ?? 0),
    );
  const projectOf = new Map(view.items.map((item) => [item.id, item.projectId]));
  return {
    epics: epics.length,
    done: epics.filter((item) => item.statusCategory === 'done').length,
    atRisk,
    conflicts: view.dependencies.filter((dependency) => dependency.conflict).length,
    acrossTeams: view.dependencies.filter(
      (dependency) => projectOf.get(dependency.fromId) !== projectOf.get(dependency.toId),
    ).length,
  };
}
