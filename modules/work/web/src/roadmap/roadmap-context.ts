import type { RoadmapItem } from '@bemmoly/module-work/shared';
import type { TimelineScale } from '@bemmoly/ui';
import { createContext, useContext } from 'react';
import type { BarPlace } from '../hooks/roadmap-bars.ts';
import type { RoadmapSchedule } from '../hooks/roadmap-schedule.ts';

/** What every row of the timeline reads: the axis, the bars, and what a row can do. */
export interface RoadmapRowShared {
  scale: TimelineScale;
  today: number;
  /** Phone widths: a narrow name column without chips or meta. */
  narrow: boolean;
  bars: ReadonlyMap<string, BarPlace>;
  schedule: RoadmapSchedule;
  /** An epic opens in the peek; a version opens its forecast. */
  open: (item: RoadmapItem) => void;
  openIssue: (key: string) => void;
  openForecast: (item: RoadmapItem) => void;
  toggle: (id: string) => void;
  personName: (id: string) => string | null;
  /** The id of the paragraph that tells how a bar moves with the keys. */
  instructionsId: string;
}

export const RoadmapRowContext = createContext<RoadmapRowShared | null>(null);

export function useRoadmapRow(): RoadmapRowShared {
  const shared = useContext(RoadmapRowContext);
  if (!shared) throw new Error('A roadmap row renders inside the roadmap timeline');
  return shared;
}
