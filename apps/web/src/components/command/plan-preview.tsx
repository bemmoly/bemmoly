import plan from '../../fixtures/command-plan.json' with { type: 'json' };
import { AiSurface, Button } from '../../ui.ts';

const COLUMNS = '90px minmax(0,1fr) 150px 90px';

/**
 * The plan table from the Command mock, rendered from a fixture so the
 * component exists before the AI runtime. Nothing can run yet, and it says so.
 */
export function PlanPreview() {
  return (
    <AiSurface label="Plan" hint="nothing happens until you confirm">
      <p className="m-0 text-nav leading-[1.55] text-tx">{plan.summary}</p>
      <div
        role="table"
        aria-label="Planned changes"
        className="overflow-hidden rounded-tile border border-ac-br bg-sf text-small"
      >
        <div
          role="row"
          style={{ gridTemplateColumns: COLUMNS }}
          className="grid gap-2.5 border-b border-br2 bg-head-bg px-3 py-1.75 text-mono font-medium tracking-[.06em] text-tx5 uppercase"
        >
          <span role="columnheader">Issue</span>
          <span role="columnheader">Change</span>
          <span role="columnheader">Field</span>
          <span role="columnheader" />
        </div>
        {plan.rows.map((row) => (
          <div
            key={row.issue + row.change}
            role="row"
            style={{ gridTemplateColumns: COLUMNS }}
            className="grid items-center gap-2.5 border-b border-row-line px-3 py-2.25 last:border-b-0"
          >
            <span role="cell" className="font-mono text-meta font-medium text-tx4">
              {row.issue}
            </span>
            <span role="cell" className={row.field ? 'text-tx3' : 'text-tx'}>
              {row.change}
            </span>
            <span role="cell" className="text-tx3">
              {row.field ?? (
                <>
                  {row.from} → <b className="font-semibold">{row.to}</b>
                </>
              )}
            </span>
            <span role="cell" className="text-right text-mono font-semibold text-ok-fg">
              {row.permission}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled className="h-control py-0">
          Run 3 changes <span className="ml-2 font-mono text-mono opacity-75">⏎</span>
        </Button>
        <Button variant="secondary" disabled className="text-tx2">
          Edit plan
        </Button>
        <span className="ml-auto text-caption text-tx5">
          Preview only: AI plans arrive with the AI runtime in a later release.
        </span>
      </div>
    </AiSurface>
  );
}
