import { Button, SettingsRow, SettingsSection } from '@bemmoly/ui';
import { ConnectionShell } from '../../components/ai/connection-shell.tsx';
import { PrivacyRows } from '../../components/ai/privacy-rows.tsx';
import { ProviderPicker } from '../../components/ai/provider-picker.tsx';
import { Notice } from '../../components/form.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { useAiSettings } from '../../hooks/use-ai-settings.ts';

export function AiPage() {
  const ai = useAiSettings();
  const { settings, draft, picker } = ai;
  const value = draft.value;
  return (
    <SettingsPage
      title="AI and models"
      description="Bemmoly works fully without AI. Pick a provider from the catalog and decide what it may see."
      loading={settings.isPending}
      // Someone without the capability may not read these settings either; the note says why.
      error={ai.canConfigure ? settings.error : null}
      actions={
        <>
          <Button variant="secondary" disabled={!draft.dirty} onClick={draft.discard}>
            Discard
          </Button>
          <Button
            variant="primary"
            onClick={ai.submit}
            disabled={!ai.canConfigure || !draft.dirty}
            loading={settings.save.isPending}
          >
            Save
          </Button>
        </>
      }
    >
      {ai.disabledReason ? <Notice tone="caution">{ai.disabledReason}</Notice> : null}
      {value ? (
        <>
          <SettingsSection title="Provider">
            <ProviderPicker
              picker={picker}
              choice={ai.choice}
              onPick={ai.pick}
              disabled={!ai.canConfigure}
            />
            <div className="flex items-center gap-3">
              <Button variant="secondary" disabled>
                Upload catalog file
              </Button>
              <span className="text-12 text-tx5">{ai.uploadNote}</span>
            </div>
          </SettingsSection>
          <ConnectionShell picker={picker} />
          <SettingsSection title="Model roles" layout="rows">
            {ai.modelRoles.map((role) => (
              <SettingsRow
                key={role.id}
                title={<span className="text-tx4">{role.label}</span>}
                description={role.status}
              />
            ))}
          </SettingsSection>
          <PrivacyRows
            title="Privacy"
            shareContent={value.shareContent}
            onShareContent={(shareContent) => draft.update({ shareContent })}
            allowActions={value.allowActions}
            onAllowActions={(allowActions) => draft.update({ allowActions })}
            disabled={!ai.canConfigure}
          />
        </>
      ) : null}
    </SettingsPage>
  );
}
