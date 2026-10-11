import type { ImportDiscovery } from '@bemmoly/shared';
import { Button, Checkbox, SettingsSection } from '@bemmoly/ui';
import { Notice } from '../form.tsx';
import { count, countLine, kindLabel } from './import-words.ts';

interface DiscoveryPanelProps {
  discovery: ImportDiscovery;
  chosen: readonly string[];
  /** The plan shown below matches the ticks; Preview plan is then not needed again. */
  planCurrent: boolean;
  busy: boolean;
  onToggle: (id: string) => void;
  onPreview: () => void;
}

/** What the connection found: the site, its totals and warnings, and what to bring in. */
export function DiscoveryPanel(props: DiscoveryPanelProps) {
  const { discovery, chosen, planCurrent, busy } = props;
  return (
    <SettingsSection
      title="What to bring in"
      hint={discovery.site}
      actions={
        <Button
          size="sm"
          variant={planCurrent ? 'secondary' : 'primary'}
          loading={busy}
          disabled={chosen.length === 0}
          onClick={props.onPreview}
        >
          Preview plan
        </Button>
      }
    >
      <p className="m-0 text-13 text-tx-2">Found {countLine(discovery.counts)}.</p>
      {discovery.warnings.map((warning) => (
        <Notice key={warning} tone="caution">
          {warning}
        </Notice>
      ))}
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-2 text-12 font-semibold text-tx-3">
          {chosen.length} of {discovery.containers.length} chosen
        </legend>
        {discovery.containers.map((container) => (
          <Checkbox
            key={container.id}
            checked={chosen.includes(container.id)}
            onChange={() => props.onToggle(container.id)}
            label={container.key ? `${container.name} (${container.key})` : container.name}
            description={
              container.count === null
                ? kindLabel(container.kind)
                : `${kindLabel(container.kind)} · ${count(container.count)} records`
            }
          />
        ))}
      </fieldset>
      {chosen.length === 0 ? (
        <p className="m-0 text-12 text-tx-3">Choose at least one to preview the plan.</p>
      ) : null}
    </SettingsSection>
  );
}
