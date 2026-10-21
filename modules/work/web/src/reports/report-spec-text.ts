import type { ReportGroup, ReportMetric, ReportSpec } from '@bemmoly/module-work/shared';

/*
 * How the report understood the question, in words: what it measures, how it groups and what
 * it reads. Shown under every asked or pinned report so a person can tell at a glance whether
 * the question was read the way they meant it.
 */

const METRICS: Record<ReportMetric, string> = {
  issues: 'Issues',
  points: 'Story points',
  open_issues: 'Open issues',
  open_points: 'Open story points',
  avg_resolution_days: 'Average days to resolve',
  progress: 'Percent done',
};

const GROUPS: Record<Exclude<ReportGroup, 'none'>, string> = {
  status: 'status',
  assignee: 'assignee',
  type: 'type',
  priority: 'priority',
  label: 'label',
  epic: 'epic',
  sprint: 'sprint',
};

const STATUS: Record<string, string> = {
  open: 'not done',
  todo: 'to do',
  in_progress: 'in progress',
  done: 'done',
};

export function describeSpec(spec: ReportSpec): string {
  const parts = [METRICS[spec.metric]];
  if (spec.groupBy !== 'none') parts.push(`by ${GROUPS[spec.groupBy]}`);
  const { filters } = spec;
  if (filters.sprint === 'active') parts.push('active sprint');
  if (filters.status && filters.status !== 'any') parts.push(STATUS[filters.status] ?? '');
  if (filters.assignee === 'me') parts.push('assigned to you');
  if (filters.assignee === 'unassigned') parts.push('unassigned');
  if (filters.types?.length) parts.push(filters.types.join(', '));
  if (filters.priorities?.length) parts.push(`${filters.priorities.join(', ')} priority`);
  if (filters.createdWithinDays)
    parts.push(`created in the last ${filters.createdWithinDays} days`);
  if (filters.resolvedWithinDays) {
    parts.push(`resolved in the last ${filters.resolvedWithinDays} days`);
  }
  return parts.filter(Boolean).join(' · ');
}
