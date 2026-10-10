import { Card } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import type { HealthRow, HealthRowStatus } from '../../hooks/use-setup-health.ts';
import { RouterLink } from '../router-link.tsx';

const CIRCLE: Record<HealthRowStatus, { look: string; mark: ReactNode; label: string }> = {
  ok: { look: 'bg-ok', mark: <Icon name="check" size={10} />, label: 'OK' },
  warning: { look: 'bg-caution', mark: '!', label: 'Needs attention' },
  failed: { look: 'bg-danger', mark: '!', label: 'Failed' },
  pending: { look: 'border border-br-ctl bg-sf', mark: null, label: 'Not checked yet' },
};

/**
 * The 16px status circle of the Setup checks and summary rows. Pass `label={null}` where the text
 * beside it already says the status, so screen readers do not hear it twice.
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
        className={`flex size-4 shrink-0 items-center justify-center rounded-full text-10 text-on-solid ${circle.look}`}
      >
        {circle.mark}
      </span>
      {spoken ? <span className="sr-only">{spoken}</span> : null}
    </>
  );
}

/**
 * Step 1's check list: status, name, the measured value, and a fix link when there is one. A
 * hint is a sentence, so it gets its own line under the name rather than crowding the column.
 */
export function HealthList({ rows }: { rows: readonly HealthRow[] }) {
  return (
    <Card aria-label="Server checks" className="flex flex-col px-4 py-1.5">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-br-row py-2.5 text-12h last:border-b-0"
        >
          <StatusCircle status={row.status} />
          <span
            className={`w-50 min-w-24 shrink font-medium ${row.status === 'pending' ? 'text-tx4' : 'text-tx'}`}
          >
            {row.name}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-12 text-tx4">{row.detail}</span>
          {row.fix ? (
            <RouterLink href={row.fix.href} className="shrink-0 font-medium text-ac">
              {row.fix.label}
            </RouterLink>
          ) : row.hint ? (
            <span className="basis-full pl-6.5 text-12 leading-body text-tx5">{row.hint}</span>
          ) : null}
        </div>
      ))}
    </Card>
  );
}
