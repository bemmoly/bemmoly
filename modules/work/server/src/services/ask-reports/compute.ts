import type {
  ReportGroup,
  ReportMetric,
  ReportResult,
  ReportRow,
  ReportSpec,
  ReportUnit,
} from '../../../../shared/ask-reports.ts';
import type { FieldValues, StatValue } from '../reports/stats.ts';

/*
 * A report spec over what the loader read, as plain arithmetic: each selected issue with its
 * estimate, dates and status category, and per issue the values it holds in the grouping
 * field. An issue with no value falls in the field's "none" bucket; an issue with several
 * (labels, assignees) counts in each, as field statistics do.
 */

export interface ReportIssue {
  id: string;
  estimate: number | null;
  createdAt: number;
  resolvedAt: number | null;
  done: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
const NONE = '\u0000none';

export const NONE_GROUP_LABELS: Record<Exclude<ReportGroup, 'none'>, string> = {
  status: 'No status',
  assignee: 'Unassigned',
  type: 'No type',
  priority: 'No priority',
  label: 'No label',
  epic: 'No epic',
  sprint: 'No sprint',
};

export const METRIC_UNITS: Record<ReportMetric, ReportUnit> = {
  issues: 'issues',
  points: 'points',
  open_issues: 'issues',
  open_points: 'points',
  avg_resolution_days: 'days',
  progress: 'percent',
};

const round = (value: number, places = 1) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/** The metric over one set of issues, and how many issues it stands on. */
export function measure(
  metric: ReportMetric,
  issues: readonly ReportIssue[],
): { value: number; issues: number } {
  switch (metric) {
    case 'issues':
      return { value: issues.length, issues: issues.length };
    case 'points':
      return {
        value: round(
          issues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0),
          2,
        ),
        issues: issues.length,
      };
    case 'open_issues': {
      const open = issues.filter((issue) => !issue.done);
      return { value: open.length, issues: open.length };
    }
    case 'open_points': {
      const open = issues.filter((issue) => !issue.done);
      const points = open.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
      return { value: round(points, 2), issues: open.length };
    }
    case 'avg_resolution_days': {
      const resolved = issues.filter((issue) => issue.done && issue.resolvedAt !== null);
      if (resolved.length === 0) return { value: 0, issues: 0 };
      const total = resolved.reduce(
        (sum, issue) => sum + Math.max(0, issue.resolvedAt! - issue.createdAt),
        0,
      );
      return { value: round(total / resolved.length / DAY), issues: resolved.length };
    }
    case 'progress': {
      if (issues.length === 0) return { value: 0, issues: 0 };
      const done = issues.filter((issue) => issue.done).length;
      return { value: round((done / issues.length) * 100, 0), issues: issues.length };
    }
  }
}

interface Bucket {
  value: StatValue;
  issues: ReportIssue[];
}

function buckets(
  group: Exclude<ReportGroup, 'none'>,
  issues: readonly ReportIssue[],
  values: FieldValues,
) {
  const byId = new Map<string, Bucket>();
  for (const issue of issues) {
    const held = values.get(issue.id);
    const list =
      held && held.length > 0 ? held : [{ id: NONE, label: NONE_GROUP_LABELS[group], order: null }];
    for (const value of list) {
      const bucket = byId.get(value.id) ?? { value, issues: [] };
      bucket.issues.push(issue);
      byId.set(value.id, bucket);
    }
  }
  return [...byId.values()];
}

/** Natural order where the field has one, then the largest values; "none" always last. */
function ordered(rows: { row: ReportRow; order: number | null }[]): ReportRow[] {
  return rows
    .sort((a, b) => {
      if ((a.row.id === null) !== (b.row.id === null)) return a.row.id === null ? 1 : -1;
      if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
      if (b.row.value !== a.row.value) return b.row.value - a.row.value;
      return a.row.label.localeCompare(b.row.label);
    })
    .map((item) => item.row);
}

export interface ComputeInput {
  spec: ReportSpec;
  issues: readonly ReportIssue[];
  /** The grouping field's values; ignored for `groupBy: 'none'`. Empty groups are dropped. */
  values: FieldValues;
  now: Date;
}

export function computeReport(input: ComputeInput): ReportResult {
  const { spec, issues } = input;
  const overall = measure(spec.metric, issues);
  const rows =
    spec.groupBy === 'none'
      ? []
      : ordered(
          buckets(spec.groupBy, issues, input.values).map((bucket) => {
            const measured = measure(spec.metric, bucket.issues);
            return {
              order: bucket.value.order,
              row: {
                id: bucket.value.id === NONE ? null : bucket.value.id,
                label: bucket.value.label,
                value: measured.value,
                issues: measured.issues,
              },
            };
          }),
        ).filter((row) => row.issues > 0);
  return {
    spec,
    unit: METRIC_UNITS[spec.metric],
    rows,
    total: overall.value,
    issues: issues.length,
    generatedAt: input.now.toISOString(),
  };
}
