import { useSetupImport } from '../../hooks/use-setup-import.ts';
import { Notice } from '../form.tsx';
import { ChoiceCard } from './choice-card.tsx';
import { IMPORT_MARKS } from './option-marks.tsx';
import { StepFooter, type StepNav } from './step-footer.tsx';

/** Step 2: the importers shown as coming soon, and Start clean picked. */
export function StepImport({ nav }: { nav: StepNav }) {
  const { sources, selected, select, notice, label, canStart, start } = useSetupImport(nav.next);
  return (
    <>
      <div role="radiogroup" aria-label="Import source" className="grid grid-cols-2 gap-3">
        {sources.map((source) => (
          <ChoiceCard
            key={source.id}
            initials={source.initials}
            icon={IMPORT_MARKS[source.id]}
            name={source.name}
            description={source.description}
            comingSoon={source.comingSoon}
            selected={selected === source.id}
            onSelect={() => select(source.id)}
          />
        ))}
      </div>
      <Notice>{notice}</Notice>
      <StepFooter nav={nav} label={label} onPrimary={start} disabled={!canStart} />
    </>
  );
}
