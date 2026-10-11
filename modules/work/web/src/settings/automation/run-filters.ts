import type { RunFilter } from './use-automation-runs.ts';

export const RUN_FILTERS: { value: RunFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'running', label: 'Running' },
  { value: 'queued', label: 'Queued' },
];
