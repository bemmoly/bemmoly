import type { ModePreference } from '@bemmoly/shared';
import { SegmentedControl } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';

export const MODES: readonly {
  value: ModePreference;
  label: string;
  short: string;
  icon: IconName;
}[] = [
  { value: 'light', label: 'Light', short: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', short: 'Dark', icon: 'moon' },
  { value: 'system', label: 'Match system', short: 'System', icon: 'monitor' },
];

interface ModeControlProps {
  value: ModePreference;
  onChange: (mode: ModePreference) => void;
  /** The user menu's narrow width says "System" for Match system. */
  compact?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Light, Dark or Match system: mode is its own choice, apart from the theme (ADR 0021). */
export function ModeControl({
  value,
  onChange,
  compact,
  className,
  'aria-label': label = 'Mode',
}: ModeControlProps) {
  return (
    <SegmentedControl
      aria-label={label}
      className={className}
      value={value}
      onChange={onChange}
      options={MODES.map((mode) => ({
        value: mode.value,
        label: (
          <span className="inline-flex items-center justify-center gap-1.5 px-2.5 whitespace-nowrap">
            <Icon name={mode.icon} size={14} />
            {compact ? mode.short : mode.label}
          </span>
        ),
      }))}
    />
  );
}
