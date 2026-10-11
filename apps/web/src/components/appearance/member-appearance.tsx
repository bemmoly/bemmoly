import { appearanceDescription } from '../../hooks/use-appearance-draft.ts';
import { usePersonalAppearance } from '../../hooks/use-personal-appearance.ts';
import { useLook } from '../../hooks/use-theme-effect.ts';
import { themeOptions } from '../../hooks/use-theme-options.ts';
import { useWorkspace } from '../../hooks/use-workspace.ts';
import { workspaceRef } from '../../lib/theme.ts';
import { SettingsPage } from '../settings/settings-page.tsx';
import { AppearanceRow } from './appearance-row.tsx';
import { ModeControl } from './mode-control.tsx';
import { ThemeGrid } from './theme-grid.tsx';

export const ADMIN_SETS_THEME = 'Your workspace admin sets the theme.';

/**
 * Settings › Appearance for everyone who cannot set the workspace look: the workspace theme,
 * read-only, and their own mode, which is the one appearance choice that is theirs (ADR 0021).
 */
export function MemberAppearance() {
  const workspace = useWorkspace();
  const personal = usePersonalAppearance();
  const look = useLook();
  const ref = workspaceRef(workspace.appearance);
  const current = themeOptions(workspace.appearance.customThemes).filter(
    (option) => option.ref === ref,
  );
  return (
    <SettingsPage breadcrumb title="Appearance" description={appearanceDescription(workspace.name)}>
      <div className="max-w-180">
        <AppearanceRow label="Theme" help={ADMIN_SETS_THEME}>
          {() => (
            <div className="max-w-90">
              <ThemeGrid options={current} selected={ref} onSelect={() => undefined} disabled />
            </div>
          )}
        </AppearanceRow>
        <AppearanceRow
          label="Your mode"
          help="Light, dark or following your device. Stored on your account, on every device."
        >
          {() => (
            <ModeControl
              aria-label="Your mode"
              value={look.preference}
              onChange={personal.setMode}
            />
          )}
        </AppearanceRow>
      </div>
    </SettingsPage>
  );
}
