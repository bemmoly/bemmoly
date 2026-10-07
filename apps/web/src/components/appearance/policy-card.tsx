import { SettingsRow, SettingsSection, Switch } from '@bemmoly/ui';

interface PolicyCardProps {
  memberModeSwitch: boolean;
  personalThemes: boolean;
  disabled: boolean;
  onChange: (patch: { memberModeSwitch?: boolean; personalThemes?: boolean }) => void;
}

/** The Policy card: what members may change for themselves. */
export function PolicyCard({
  memberModeSwitch,
  personalThemes,
  disabled,
  onChange,
}: PolicyCardProps) {
  return (
    <SettingsSection title="Policy" layout="rows">
      <SettingsRow
        title="Let members switch light / dark"
        description="Brand color and typeface stay fixed."
        control={
          <Switch
            aria-label="Let members switch light / dark"
            checked={memberModeSwitch}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ memberModeSwitch: checked })}
          />
        }
      />
      <SettingsRow
        title="Allow personal themes"
        description="Members can pick any preset for themselves."
        control={
          <Switch
            aria-label="Allow personal themes"
            checked={personalThemes}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ personalThemes: checked })}
          />
        }
      />
    </SettingsSection>
  );
}
