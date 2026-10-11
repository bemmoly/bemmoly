import type { ImportJob } from '@bemmoly/shared';
import { RelativeTime, SettingsSection } from '@bemmoly/ui';
import { StatePill } from '../settings/state-pill.tsx';
import { STATUS_WORDS } from './import-words.ts';

interface RecentImportsProps {
  jobs: readonly ImportJob[];
  openId: string | null;
  onOpen: (id: string) => void;
}

/** The latest imports; opening one shows it where it is (plan, progress or report). */
export function RecentImports({ jobs, openId, onOpen }: RecentImportsProps) {
  if (jobs.length === 0) return null;
  return (
    <SettingsSection title="Recent imports" layout="rows">
      <ul className="m-0 flex list-none flex-col p-0">
        {jobs.map((job) => {
          const words = STATUS_WORDS[job.status];
          return (
            <li key={job.id} className="border-b border-line-2 last:border-b-0">
              <button
                type="button"
                aria-current={openId === job.id || undefined}
                onClick={() => onOpen(job.id)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-control border-0 bg-transparent px-1 py-2.5 text-left font-sans text-13 text-tx hover:bg-hover focus-ring-inset"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {job.sourceLabel}
                  {job.discovery ? (
                    <span className="font-normal text-tx-3"> · {job.discovery.site}</span>
                  ) : null}
                </span>
                <RelativeTime iso={job.createdAt} className="shrink-0 text-12 text-tx-3" />
                <StatePill tone={words.tone}>{words.label}</StatePill>
              </button>
            </li>
          );
        })}
      </ul>
    </SettingsSection>
  );
}
