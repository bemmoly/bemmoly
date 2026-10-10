import { SettingsRow, SettingsSection, Switch } from '@bemmoly/ui';
import { PRIVACY_ROWS } from '../../hooks/use-ai-settings.ts';

export type PrivacyKey = keyof typeof PRIVACY_ROWS;

interface PrivacySwitchProps {
  row: PrivacyKey;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

/** One privacy choice: its words from PRIVACY_ROWS and a switch that applies at once. */
export function PrivacySwitch({ row, checked, onChange, disabled }: PrivacySwitchProps) {
  const copy = PRIVACY_ROWS[row];
  return (
    <SettingsRow
      title={copy.label}
      description={copy.hint}
      control={
        <Switch
          aria-label={copy.label}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      }
    />
  );
}

interface PrivacyRowsProps {
  shareContent: boolean;
  onShareContent: (value: boolean) => void;
  allowActions: boolean;
  onAllowActions: (value: boolean) => void;
  title: string;
}

/** The wizard's two privacy choices; the rest wait in Settings › AI › Privacy. */
export function PrivacyRows({
  shareContent,
  onShareContent,
  allowActions,
  onAllowActions,
  title,
}: PrivacyRowsProps) {
  return (
    <SettingsSection title={title} hint="More in Settings › AI › Privacy" layout="rows">
      <PrivacySwitch row="shareContent" checked={shareContent} onChange={onShareContent} />
      <PrivacySwitch row="allowActions" checked={allowActions} onChange={onAllowActions} />
    </SettingsSection>
  );
}
