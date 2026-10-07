import { Link } from '@tanstack/react-router';
import { useSetupAppearance } from '../../hooks/use-setup-appearance.ts';
import { presetTileColors, ThemeTile } from '../appearance/theme-tile.tsx';
import { StepFooter, type StepNav } from './step-footer.tsx';

/** Step 5: the eight preset tiles and the way to a custom theme. */
export function StepAppearance({ nav }: { nav: StepNav }) {
  const { choices, selected, select, customLink, save, submit } = useSetupAppearance(nav.next);
  return (
    <>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-4 gap-2.5">
        {choices.map((choice) => (
          <ThemeTile
            key={choice.id}
            name={choice.name}
            colors={presetTileColors(choice.id)}
            selected={selected === choice.id}
            onSelect={() => select(choice.id)}
          />
        ))}
      </div>
      <Link to={customLink.to} className="self-start font-medium text-ac">
        {customLink.label}
      </Link>
      <StepFooter nav={nav} onPrimary={submit} loading={save.isPending} />
    </>
  );
}
