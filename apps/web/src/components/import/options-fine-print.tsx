import type { ImportMapping } from '@bemmoly/shared';
import { SettingsSection } from '@bemmoly/ui';
import { useId, useState } from 'react';
import type { ImportOptions } from '../../hooks/use-import-options.ts';
import { DisclosureButton } from './disclosure-button.tsx';
import { count, finePrintOf, kindLabel } from './import-words.ts';
import { groups, MappingRow } from './mapping-row.tsx';

/** "14 match · 2 created · 1 reported". */
export function mappingSummary(mappings: readonly ImportMapping[]): string {
  const of = (action: ImportMapping['action']) =>
    mappings.filter((mapping) => mapping.action === action).length;
  return `${count(of('match'))} match · ${count(of('create'))} created · ${count(of('report'))} reported`;
}

/**
 * Statuses, types and fields (Confluence: macros and formatting), collapsed to one summary
 * line; opening it shows each mapping row as the plan made it.
 */
export function OptionsFinePrint({ options }: { options: ImportOptions }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const mappings = finePrintOf(options.plan?.mappings ?? []);
  const docs = options.nouns.container === 'space';
  if (mappings.length === 0 && !docs) return null;
  return (
    <SettingsSection
      title={docs ? 'Macros and formatting' : 'Statuses, types and fields'}
      hint={mappingSummary(mappings)}
    >
      {docs ? (
        <p className="m-0 text-13 text-tx-2">
          Macros without a Docs block are kept as labelled blocks with their original markup, so
          nothing is lost.
        </p>
      ) : null}
      {mappings.length > 0 ? (
        <>
          <DisclosureButton expanded={open} controls={listId} onToggle={() => setOpen(!open)}>
            {open ? 'Hide the mapping' : `Show all ${count(mappings.length)}`}
          </DisclosureButton>
          <div id={listId} hidden={!open} className="flex flex-col gap-3">
            {open
              ? groups(mappings).map(([kind, rows]) => (
                  <div key={kind} className="flex flex-col">
                    <h3 className="m-0 text-12 font-semibold text-tx-3">{kindLabel(kind)}</h3>
                    <ul className="m-0 flex list-none flex-col p-0">
                      {rows.map((mapping) => (
                        <MappingRow key={`${mapping.kind}:${mapping.source}`} mapping={mapping} />
                      ))}
                    </ul>
                  </div>
                ))
              : null}
          </div>
        </>
      ) : null}
    </SettingsSection>
  );
}
