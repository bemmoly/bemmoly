import { SettingsSection } from '@bemmoly/ui';
import type { ThemeOption } from '../../hooks/use-appearance-draft.ts';
import { ThemeTile } from './theme-tile.tsx';

interface ThemeCardProps {
  options: readonly ThemeOption[];
  selected: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}

/** The Theme card: the eight presets and Custom, two to a row (14px 16px, 10px gap). */
export function ThemeCard({ options, selected, onSelect, disabled }: ThemeCardProps) {
  return (
    <SettingsSection title="Theme">
      <fieldset disabled={disabled} className="mx-0 -my-0.5 min-w-0 border-0 p-0">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2.5">
          {options.map((option) => (
            <ThemeTile
              key={option.id}
              name={option.name}
              mode={option.mode}
              colors={option.colors}
              selected={option.id === selected}
              onSelect={() => onSelect(option.id)}
            />
          ))}
        </div>
      </fieldset>
    </SettingsSection>
  );
}
