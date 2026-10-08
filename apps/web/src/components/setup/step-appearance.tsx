import { useId } from 'react';
import { useSetupAppearance } from '../../hooks/use-setup-appearance.ts';
import { CustomThemeCard } from '../appearance/custom-theme-card.tsx';
import { presetTileColors, ThemeTile } from '../appearance/theme-tile.tsx';
import { LINK_ACTION } from '../actions.ts';
import { StepFooter, type StepNav } from './step-footer.tsx';

/**
 * Step 5: the eight preset tiles, and under them a toggle that opens the custom
 * theme builder in place. Whatever is chosen is previewed on the whole page.
 */
export function StepAppearance({ nav }: { nav: StepNav }) {
  const state = useSetupAppearance(nav.next);
  const { custom } = state;
  const panelId = useId();
  return (
    <>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-4 gap-2.5">
        {state.choices.map((choice) => (
          <ThemeTile
            key={choice.id}
            name={choice.name}
            colors={presetTileColors(choice.id)}
            selected={state.selected === choice.id}
            onSelect={() => state.select(choice.id)}
          />
        ))}
      </div>
      <button
        type="button"
        aria-expanded={state.customOpen}
        aria-controls={panelId}
        onClick={state.toggleCustom}
        className={`${LINK_ACTION} self-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac`}
      >
        {state.toggleLabel}
      </button>
      <div id={panelId} hidden={!state.customOpen}>
        {state.customOpen ? (
          <CustomThemeCard
            value={state.draft}
            active
            disabled={false}
            workspaceName={state.workspaceName}
            scope={state.scope}
            hex={custom.hex}
            contrast={custom.contrast}
            onPickBrand={custom.pickBrand}
            onMode={custom.setMode}
            onSurfaces={custom.setSurfaces}
            onFont={custom.setFont}
          />
        ) : null}
      </div>
      <StepFooter nav={nav} onPrimary={state.submit} loading={state.save.isPending} />
    </>
  );
}
