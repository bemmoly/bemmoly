import { useSetupImport } from '../../hooks/use-setup-import.ts';
import { ChoiceCard } from './choice-card.tsx';
import { IMPORT_MARKS } from './option-marks.tsx';
import { StepFooter, StepForm, type StepNav } from './step-footer.tsx';

/** Import: the importers shown as coming soon, and Start clean picked. */
export function StepImport({ nav }: { nav: StepNav }) {
  const { sources, selected, select, notice, label, canStart, start } = useSetupImport(nav.next);
  return (
    <StepForm label="Import" onSubmit={start}>
      <div role="radiogroup" aria-label="Import source" className="grid gap-3 sm:grid-cols-2">
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
      <p className="m-0 text-13 text-tx-3">{notice}</p>
      <StepFooter nav={nav} label={label} disabled={!canStart} />
    </StepForm>
  );
}
