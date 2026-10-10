import { Icon } from '@bemmoly/ui/icons';
import { useId, useState, type ReactNode } from 'react';
import {
  fixLater,
  healthSummary,
  type HealthRow,
  type HealthRowStatus,
} from '../../hooks/use-setup-health.ts';

const CIRCLE: Record<HealthRowStatus, { look: string; mark: ReactNode; label: string }> = {
  ok: { look: 'bg-green text-on-solid', mark: <Icon name="check" size={10} />, label: 'OK' },
  warning: { look: 'bg-amber text-on-solid', mark: <Icon name="minus" size={10} />, label: 'Needs attention' },
  failed: { look: 'bg-red text-on-solid', mark: <Icon name="close" size={10} />, label: 'Failed' },
  pending: { look: 'border-[1.5px] border-line-2', mark: null, label: 'Not checked yet' },
};

/**
 * The 16px status circle of the server checks. Pass `label={null}` where the text beside it
 * already says the status, so screen readers do not hear it twice.
 */
export function StatusCircle({
  status,
  label,
}: {
  status: HealthRowStatus;
  label?: string | null;
}) {
  const circle = CIRCLE[status];
  const spoken = label === undefined ? circle.label : label;
  return (
    <>
      <span
        aria-hidden="true"
        className={`flex size-4 shrink-0 items-center justify-center rounded-full ${circle.look}`}
      >
        {circle.mark}
      </span>
      {spoken ? <span className="sr-only">{spoken}</span> : null}
    </>
  );
}

/** The six checks, each with its measured value and, when it needs one, what to do. */
function HealthRows({ rows }: { rows: readonly HealthRow[] }) {
  return (
    <ul aria-label="Server checks" className="m-0 flex list-none flex-col p-0">
      {rows.map((row) => {
        const later = row.status === 'ok' ? null : fixLater(row);
        return (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 border-t border-line py-2 text-13"
          >
            <StatusCircle status={row.status} />
            <span className={`w-44 shrink font-medium ${row.status === 'pending' ? 'text-tx-3' : 'text-tx'}`}>
              {row.name}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-12 text-tx-3" title={row.detail}>
              {row.detail}
            </span>
            {later ? <span className="basis-full pl-6.5 text-12 text-tx-2">{later}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The checks collapsed to one line: "Server healthy · Postgres 18, 38 GB free, backups
 * nightly". Details opens the six rows; anything failing or needing attention opens them on
 * its own, with what to do in words.
 */
export function HealthSummary({ rows }: { rows: readonly HealthRow[] }) {
  const summary = healthSummary(rows);
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? summary.open;
  const panelId = useId();
  const status: HealthRowStatus = summary.tone;
  return (
    <section
      aria-label="Server health"
      className="flex flex-col rounded-card border border-line bg-card px-3.5"
    >
      <div className="flex min-h-11 items-center gap-2.5 text-13">
        <StatusCircle status={status} label={null} />
        <span role="status" className="min-w-0 flex-1 truncate text-tx-2" title={summary.text}>
          {summary.text}
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setUserOpen(!open)}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-chip border-0 bg-transparent px-1.5 py-1 font-sans text-12 font-medium text-tx-2 hover:bg-hover hover:text-tx focus-ring"
        >
          Details
          <span className={`flex motion-safe:transition-transform ${open ? 'rotate-180' : ''}`}>
            <Icon name="caret" size={12} />
          </span>
        </button>
      </div>
      <div id={panelId} hidden={!open} className="pb-1">
        {open ? <HealthRows rows={rows} /> : null}
      </div>
    </section>
  );
}
