import { SegmentedControl } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useId } from 'react';
import { useSetupAppearance } from '../../hooks/use-setup-appearance.ts';
import { BrandColorField } from '../appearance/brand-color-field.tsx';
import { BoardMiniature } from './board-miniature.tsx';
import { LogoPreview } from './logo-preview.tsx';
import { StepFooter, StepForm, type StepNav } from './step-footer.tsx';

const MODES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

const SURFACES = [
  { value: 'neutral', label: 'Neutral grey' },
  { value: 'tinted', label: 'Brand-tinted' },
] as const;

type Look = ReturnType<typeof useSetupAppearance>;

/** A preset as the real Board in its colours, then its name; the chosen one has the ring. */
function LookTile({ look, choice }: { look: Look; choice: Look['choices'][number] }) {
  const selected = look.selected === choice.id;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => look.select(choice.id)}
      className={`flex cursor-pointer flex-col gap-1.5 rounded-card border bg-card p-1.5 text-left font-sans focus-ring ${
        selected ? 'border-acc shadow-ring' : 'border-line hover:border-line-2'
      }`}
    >
      <BoardMiniature scope={{ 'data-theme': choice.id }} />
      <span className="flex items-center gap-1.5 px-0.5 text-13 font-medium text-tx">
        {choice.name}
        {selected ? (
          <span className="ml-auto flex text-acc">
            <Icon name="check" size={14} />
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** The brand color, inline: swatches and hex turn it on; mode and surfaces follow when it is. */
function BrandRow({ look }: { look: Look }) {
  const panelId = useId();
  const modeId = useId();
  const surfacesId = useId();
  const active = look.customOpen;
  return (
    <section
      aria-label="Brand color"
      className={`flex flex-col gap-3 rounded-card border bg-card p-3.5 ${
        active ? 'border-acc shadow-ring' : 'border-line'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <span className="hidden w-32 shrink-0 sm:block">
          <BoardMiniature scope={look.customScope} />
        </span>
        <div className="min-w-0 flex-1">
          <BrandColorField
            brand={look.custom.value.brand}
            hex={look.brand.hex}
            onPick={look.brand.pick}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={active}
          aria-controls={panelId}
          onClick={look.toggleCustom}
          className="cursor-pointer rounded-chip border-0 bg-transparent p-0 font-sans text-13 font-medium text-acc hover:underline focus-ring"
        >
          {look.toggleLabel}
        </button>
        <div id={panelId} hidden={!active} className="ml-auto">
          {active ? (
            <div className="flex flex-wrap items-center gap-2 text-13">
              <span id={modeId} className="text-tx-3">
                Mode
              </span>
              <SegmentedControl
                size="sm"
                aria-labelledby={modeId}
                options={MODES}
                value={look.custom.value.mode}
                onChange={look.custom.setMode}
              />
              <span id={surfacesId} className="ml-2 text-tx-3">
                Surfaces
              </span>
              <SegmentedControl
                size="sm"
                aria-labelledby={surfacesId}
                options={SURFACES}
                value={look.custom.value.surfaces}
                onChange={look.custom.setSurfaces}
              />
            </div>
          ) : null}
        </div>
      </div>
      {active ? <p className="m-0 text-12 text-tx-3">{look.custom.contrast}</p> : null}
    </section>
  );
}

/**
 * Look: the eight presets as the real Board in miniature, the brand color inline, and where a
 * logo will go. Whatever is chosen previews on the whole wizard at once.
 */
export function StepLook({ nav }: { nav: StepNav }) {
  const look = useSetupAppearance(nav.next);
  return (
    <StepForm label="Look" onSubmit={look.submit} busy={look.save.isPending}>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {look.choices.map((choice) => (
          <LookTile key={choice.id} look={look} choice={choice} />
        ))}
      </div>
      <BrandRow look={look} />
      <LogoPreview workspaceName={look.workspaceName} brand={look.custom.value.brand} />
      <StepFooter nav={nav} loading={look.save.isPending} error={look.save.error} />
    </StepForm>
  );
}
