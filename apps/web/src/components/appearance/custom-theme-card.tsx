import type { SurfaceTone, ThemeFont, ThemeMode } from '@bemmoly/shared';
import { SegmentedControl, SettingsSection } from '@bemmoly/ui';
import type { AppearanceDraft, ThemeScope } from '../../hooks/use-appearance-draft.ts';
import { Notice } from '../form.tsx';
import { BrandColorField } from './brand-color-field.tsx';
import { LogoRow } from './logo-row.tsx';
import { TypefacePicker } from './typeface-picker.tsx';

const MODES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

const TONES = [
  { value: 'neutral', label: 'Neutral grey' },
  { value: 'tinted', label: 'Brand-tinted' },
] as const;

interface CustomThemeCardProps {
  value: AppearanceDraft;
  active: boolean;
  disabled: boolean;
  workspaceName: string;
  scope: ThemeScope;
  hex: { text: string; error: string | null; onChange: (text: string) => void };
  contrast: string;
  onPickBrand: (brand: string) => void;
  onMode: (mode: ThemeMode) => void;
  onSurfaces: (surfaces: SurfaceTone) => void;
  onFont: (font: ThemeFont) => void;
}

/** The Custom theme card: dimmed to half until Custom is the selected theme. */
export function CustomThemeCard(props: CustomThemeCardProps) {
  const { value, active, disabled } = props;
  return (
    <SettingsSection
      title="Custom theme"
      hint={active ? `${props.workspaceName} brand` : 'Select "Custom" above to edit'}
      className={active ? undefined : 'opacity-50'}
    >
      <fieldset disabled={disabled} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        <BrandColorField brand={value.brand} hex={props.hex} onPick={props.onPickBrand} />
        <div className="grid grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-2">
            <span id="appearance-mode" className="font-medium">
              Mode
            </span>
            <SegmentedControl
              aria-labelledby="appearance-mode"
              options={MODES}
              value={value.mode}
              onChange={props.onMode}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span id="appearance-surfaces" className="font-medium">
              Surfaces
            </span>
            <SegmentedControl
              aria-labelledby="appearance-surfaces"
              options={TONES}
              value={value.surfaces}
              onChange={props.onSurfaces}
            />
          </div>
        </div>
        <TypefacePicker value={value.font} onChange={props.onFont} />
        <LogoRow workspaceName={props.workspaceName} scope={props.scope} />
        <Notice>{props.contrast}</Notice>
      </fieldset>
    </SettingsSection>
  );
}
