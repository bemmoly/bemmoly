import { Input } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useSetupAppearance } from '../../hooks/use-setup-appearance.ts';
import { ModeControl } from '../appearance/mode-control.tsx';
import { ThemeTile } from '../appearance/theme-tile.tsx';
import { StepFooter, StepForm, type StepNav } from './step-footer.tsx';

type Look = ReturnType<typeof useSetupAppearance>;

/** The last tile: one hex, made to work in light and dark, previewed as soon as it is valid. */
function BrandTile({ look }: { look: Look }) {
  return (
    <div
      className={`flex min-w-0 flex-col justify-center gap-2 rounded-card border p-3 ${
        look.custom ? 'border-acc shadow-ring' : 'border-line'
      }`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={look.custom}
        onClick={look.useBrand}
        className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left font-sans text-12 font-semibold text-tx focus-ring"
      >
        Your brand colour
        {look.custom ? <Icon name="check" size={14} className="ml-auto text-acc" /> : null}
      </button>
      <span className="text-12 text-tx-3">One hex. We make it work in light and dark.</span>
      <Input
        aria-label="Brand colour hex"
        aria-invalid={look.hex.error ? true : undefined}
        mono
        spellCheck={false}
        value={look.hex.text}
        onChange={(event) => look.hex.onChange(event.target.value)}
        prefix={
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 rounded-chip"
            style={{ background: look.brandSource.light['acc-fill'] }}
          />
        }
      />
      {look.hex.error ? <span className="text-12 text-red-tx">{look.hex.error}</span> : null}
    </div>
  );
}

/**
 * Look: the five themes, each in light and dark, a brand colour as the sixth choice, and the
 * workspace default mode. Whatever is chosen previews on the whole wizard at once.
 */
export function StepLook({ nav }: { nav: StepNav }) {
  const look = useSetupAppearance(nav.next);
  return (
    <StepForm label="Look" onSubmit={look.submit} busy={look.save.isPending}>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {look.themes.map((source) => (
          <ThemeTile
            key={source.id}
            source={source}
            note={source.tag}
            selected={look.selected === source.id}
            onSelect={() => look.select(source.id)}
          />
        ))}
        <BrandTile look={look} />
      </div>
      <div className="flex flex-wrap items-center gap-3.5 border-t border-line pt-3.5">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Default mode</div>
          <div className="text-12 text-tx-3">
            Match system follows each person’s computer. You can change this later in Settings.
          </div>
        </div>
        <ModeControl aria-label="Default mode" value={look.mode} onChange={look.setMode} />
      </div>
      <StepFooter nav={nav} loading={look.save.isPending} error={look.save.error} />
    </StepForm>
  );
}
