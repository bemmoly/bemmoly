import { Button, SegmentedControl } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { FONT_IDS, FONTS } from '@bemmoly/ui/tokens';
import { useNavigate } from '@tanstack/react-router';
import { AppearanceRow } from '../../components/appearance/appearance-row.tsx';
import { LivePreview } from '../../components/appearance/live-preview.tsx';
import { LogoRow } from '../../components/appearance/logo-row.tsx';
import { MemberAppearance } from '../../components/appearance/member-appearance.tsx';
import { ModeControl } from '../../components/appearance/mode-control.tsx';
import { BrandTile, ThemeGrid } from '../../components/appearance/theme-grid.tsx';
import { Notice } from '../../components/form.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { NO_APPEARANCE_PERMISSION, useAppearance } from '../../hooks/use-appearance.ts';
import { useMe } from '../../hooks/use-session.ts';
import { useWorkspaceLogo } from '../../hooks/use-workspace-logo.ts';
import { CUSTOM_PREFIX } from '../../lib/theme.ts';

const FONT_OPTIONS = FONT_IDS.map((id) => ({ value: id, label: FONTS[id].name }));

/**
 * Settings › Appearance. A workspace admin sets the theme, logo, default mode and typeface; anyone
 * else sees the theme read-only beside their own mode (ADR 0021).
 */
export function AppearancePage() {
  const canManage = useMe().can('workspace.appearance.manage');
  return canManage ? <WorkspaceAppearance /> : <MemberAppearance />;
}

function WorkspaceAppearance() {
  const state = useAppearance();
  const logo = useWorkspaceLogo();
  const navigate = useNavigate();
  const { value, canManage, draft, source } = state;
  const locked = !canManage;
  const editing = value?.theme.startsWith(CUSTOM_PREFIX)
    ? value.theme.slice(CUSTOM_PREFIX.length)
    : null;
  const open = (id: string) =>
    void navigate({ to: '/settings/appearance/themes/$themeId', params: { themeId: id } });
  return (
    <SettingsPage
      breadcrumb
      title="Appearance"
      description={state.description}
      loading={state.settings.isPending}
      error={state.settings.error}
      actions={
        <>
          <Button variant="secondary" disabled={!draft.dirty} onClick={state.discard}>
            Discard
          </Button>
          <Button
            variant="primary"
            disabled={locked || !draft.dirty}
            loading={state.settings.save.isPending}
            onClick={state.submit}
          >
            Save for workspace
          </Button>
        </>
      }
    >
      {value && source ? (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {locked ? <Notice tone="caution">{NO_APPEARANCE_PERMISSION}</Notice> : null}
            <AppearanceRow
              label="Theme"
              help="Every theme comes in light and dark. Pick the look; the mode is a separate choice."
            >
              {() => (
                <div className="flex flex-col gap-2.5">
                  <ThemeGrid
                    options={state.options}
                    selected={value.theme}
                    onSelect={(theme) => state.update({ theme })}
                    disabled={locked}
                    extra={
                      canManage ? (
                        <BrandTile
                          title="Your brand colour"
                          description="One hex; we build the light and dark versions and check contrast."
                          action={
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Icon name="plus" />}
                              onClick={() =>
                                void navigate({ to: '/settings/appearance/themes/new' })
                              }
                            >
                              Add brand colour
                            </Button>
                          }
                        />
                      ) : null
                    }
                  />
                  {editing && canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      icon={<Icon name="edit" />}
                      onClick={() => open(editing)}
                    >
                      Edit {source.name}
                    </Button>
                  ) : null}
                </div>
              )}
            </AppearanceRow>
            <LogoRow state={logo} source={source} />
            <AppearanceRow
              label="Default mode"
              help="What new people and signed-out pages see until someone chooses."
            >
              {() => (
                <div className="flex flex-col items-start gap-2">
                  <fieldset disabled={locked} className="m-0 border-0 p-0">
                    <ModeControl
                      aria-label="Default mode"
                      value={value.defaultMode}
                      onChange={(defaultMode) => state.update({ defaultMode })}
                    />
                  </fieldset>
                  <span className="text-12 text-tx-3">
                    Stored on the workspace. A person’s own choice is stored on their account and
                    follows them to every device.
                  </span>
                </div>
              )}
            </AppearanceRow>
            <AppearanceRow
              label="Typeface"
              help="Separate from the theme, so changing the look never swaps the font."
            >
              {() => (
                <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
                  <SegmentedControl
                    aria-label="Typeface"
                    size="sm"
                    className="w-fit max-w-full overflow-x-auto"
                    options={FONT_OPTIONS}
                    value={value.font}
                    onChange={(font) => state.update({ font })}
                  />
                </fieldset>
              )}
            </AppearanceRow>
          </div>
          <LivePreview
            source={source}
            view={state.preview.view}
            onView={state.preview.setView}
            workspaceName={state.workspaceName}
            aiEnabled={state.aiEnabled}
          />
        </div>
      ) : null}
    </SettingsPage>
  );
}
