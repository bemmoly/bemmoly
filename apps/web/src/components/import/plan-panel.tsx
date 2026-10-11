import type { ImportMapping, ImportPlan } from '@bemmoly/shared';
import { Button, SettingsSection } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { FormError } from '../form.tsx';
import { StatePill, type PillTone } from '../settings/state-pill.tsx';
import { countLine, kindLabel } from './import-words.ts';

const ACTION: Record<ImportMapping['action'], { label: string; tone: PillTone }> = {
  match: { label: 'Matched', tone: 'ok' },
  create: { label: 'Created', tone: 'acc' },
  report: { label: 'Reported only', tone: 'warn' },
};

function groups(mappings: readonly ImportMapping[]) {
  const byKind = new Map<string, ImportMapping[]>();
  for (const mapping of mappings) {
    byKind.set(mapping.kind, [...(byKind.get(mapping.kind) ?? []), mapping]);
  }
  return [...byKind.entries()];
}

function MappingRow({ mapping }: { mapping: ImportMapping }) {
  const action = ACTION[mapping.action];
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-2 py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-13 text-tx" title={mapping.source}>
        {mapping.source}
      </span>
      {mapping.target ? (
        <span className="flex min-w-0 items-center gap-1.5 text-13 text-tx-2">
          <Icon name="arrow" size={12} />
          <span className="truncate">{mapping.target}</span>
        </span>
      ) : null}
      <StatePill tone={action.tone}>{action.label}</StatePill>
      {mapping.note ? <span className="w-full text-12 text-tx-3">{mapping.note}</span> : null}
    </li>
  );
}

interface PlanPanelProps {
  plan: ImportPlan;
  /** False after the ticks changed: the plan is out of date until previewed again. */
  current: boolean;
  starting: boolean;
  error: unknown;
  onStart: () => void;
}

/** How each thing at the source lands, grouped by kind, then Start import. */
export function PlanPanel({ plan, current, starting, error, onStart }: PlanPanelProps) {
  return (
    <SettingsSection title="Plan" hint={countLine(plan.counts)}>
      {groups(plan.mappings).map(([kind, rows]) => (
        <div key={kind} className="flex flex-col">
          <h3 className="m-0 text-12 font-semibold text-tx-3">{kindLabel(kind)}</h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {rows.map((mapping) => (
              <MappingRow key={`${mapping.kind}:${mapping.source}`} mapping={mapping} />
            ))}
          </ul>
        </div>
      ))}
      <p className="m-0 text-12 text-tx-3">
        Matched items join what is already here; reported items are listed in the report and not
        brought in.
      </p>
      <FormError error={error} />
      <div className="flex flex-wrap items-center justify-end gap-3">
        {current ? null : (
          <span className="text-12 text-tx-3">The choices changed. Preview the plan again.</span>
        )}
        <Button variant="primary" loading={starting} disabled={!current} onClick={onStart}>
          Start import
        </Button>
      </div>
    </SettingsSection>
  );
}
