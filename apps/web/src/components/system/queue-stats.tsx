import type { SystemStatus } from '@bemmoly/shared';
import { Card } from '@bemmoly/ui';

const STATS: Array<{ key: keyof SystemStatus['queue']; label: string }> = [
  { key: 'queued', label: 'Queued' },
  { key: 'active', label: 'Active' },
  { key: 'failed', label: 'Failed' },
  { key: 'scheduled', label: 'Scheduled' },
];

/** Background jobs (pg-boss) as four small counts. */
export function QueueStats({ queue }: { queue: SystemStatus['queue'] }) {
  return (
    <dl className="m-0 grid grid-cols-4 gap-3">
      {STATS.map((stat) => (
        <Card key={stat.key} className="flex flex-col gap-1 px-4 py-3">
          <dt className="text-11 font-medium tracking-caps text-tx5 uppercase">{stat.label}</dt>
          <dd
            className={`m-0 font-mono text-22 font-semibold tracking-title ${stat.key === 'failed' && queue.failed > 0 ? 'text-danger' : 'text-tx'}`}
          >
            {queue[stat.key]}
          </dd>
        </Card>
      ))}
    </dl>
  );
}
