import { useSetupImport } from '../../hooks/use-setup-import.ts';
import { Notice } from '../form.tsx';
import { ChoiceCard } from './choice-card.tsx';
import { StepFooter, type StepNav } from './step-footer.tsx';

/** Step 2: the four import cards; the primary stays off until importers exist. */
export function StepImport({ nav }: { nav: StepNav }) {
  const { sources, selected, select, notice, canStart } = useSetupImport();
  return (
    <>
      <div role="radiogroup" aria-label="Import source" className="grid grid-cols-2 gap-3">
        {sources.map((source) => (
          <ChoiceCard
            key={source.id}
            initials={source.initials}
            name={source.name}
            description={source.description}
            selected={selected === source.id}
            onSelect={() => select(source.id)}
          />
        ))}
      </div>
      <Notice>{notice}</Notice>
      <StepFooter nav={nav} disabled={!canStart} />
    </>
  );
}
