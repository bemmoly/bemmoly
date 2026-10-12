import { count } from './import-words.ts';

/** Issues, Comments, Attachments, Skipped: one tile each, two across on a phone. */
export function ReportStats({ stats }: { stats: { label: string; value: number }[] }) {
  return (
    <dl className="m-0 grid grid-cols-4 gap-3 max-sm:grid-cols-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col gap-1 rounded-card border border-line bg-card px-3.5 py-3"
        >
          <dt className="text-12 text-tx-3">{stat.label}</dt>
          <dd className="m-0 text-20 font-semibold text-tx tabular-nums">{count(stat.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
