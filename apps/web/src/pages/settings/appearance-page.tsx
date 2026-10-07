import { Button } from '@bemmoly/ui';
import { CustomThemeCard } from '../../components/appearance/custom-theme-card.tsx';
import { LivePreview } from '../../components/appearance/live-preview.tsx';
import { PolicyCard } from '../../components/appearance/policy-card.tsx';
import { ThemeCard } from '../../components/appearance/theme-card.tsx';
import { Notice } from '../../components/form.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { NO_APPEARANCE_PERMISSION, useAppearance } from '../../hooks/use-appearance.ts';

/** Settings › Appearance, from the Appearance Settings mock. */
export function AppearancePage() {
  const state = useAppearance();
  const { value, canManage, draft } = state;
  const locked = !canManage;
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
      {value ? (
        <>
          {locked ? <Notice tone="caution">{NO_APPEARANCE_PERMISSION}</Notice> : null}
          <div className="grid grid-cols-[400px_612px] items-start gap-7">
            <div className="flex flex-col gap-5">
              <ThemeCard
                options={state.options}
                selected={value.preset}
                onSelect={state.selectTheme}
                disabled={locked}
              />
              <CustomThemeCard
                value={value}
                active={state.isCustom}
                disabled={locked}
                workspaceName={state.workspaceName}
                scope={state.preview.scope}
                hex={state.hex}
                contrast={state.contrast}
                onPickBrand={state.pickBrand}
                onMode={state.setMode}
                onSurfaces={state.setSurfaces}
                onFont={state.setFont}
              />
              <PolicyCard
                memberModeSwitch={value.memberModeSwitch}
                personalThemes={value.personalThemes}
                disabled={locked}
                onChange={state.setPolicy}
              />
            </div>
            <LivePreview
              label={state.preview.label}
              view={state.preview.view}
              onView={state.preview.setView}
              scope={state.preview.scope}
              workspaceName={state.workspaceName}
            />
          </div>
        </>
      ) : null}
    </SettingsPage>
  );
}
