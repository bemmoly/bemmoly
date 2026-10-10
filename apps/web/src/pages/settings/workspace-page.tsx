import {
  Field,
  Input,
  Select,
  SettingsSection,
  SettingsValue,
  SettingsValues,
  UnsavedChangesBar,
} from '@bemmoly/ui';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { useSectionEdits } from '../../components/settings/use-section-edits.ts';
import { LOCALES, TIMEZONES, useWorkspaceSettings } from '../../hooks/use-workspace-settings.ts';

const URL_HINT = 'Set by BEMMOLY_PUBLIC_URL on the server.';
const TIMEZONE_HINT = 'Backups and digests run on this clock.';

export function WorkspacePage() {
  const { settings, draft, errors, save, discard } = useWorkspaceSettings();
  const edits = useSectionEdits({
    workspace: { title: 'Workspace', dirty: draft.dirty, discard },
  });
  const value = draft.value;
  const reading = edits.mode('workspace') === 'read';
  return (
    <SettingsPage
      title="General"
      description="The name and address everyone sees, and the defaults for dates and times."
      loading={settings.isPending}
      error={settings.error}
    >
      {value ? (
        <>
          <SettingsSection
            {...edits.section('workspace')}
            layout={reading ? 'rows' : 'block'}
            saving={settings.save.isPending}
            onSave={() => save(() => edits.close('workspace'))}
          >
            {reading ? (
              <SettingsValues>
                <SettingsValue label="Workspace name">{value.name}</SettingsValue>
                <SettingsValue label="URL" mono hint={URL_HINT}>
                  {value.url}
                </SettingsValue>
                <SettingsValue label="Language">
                  {LOCALES.find((locale) => locale.value === value.locale)?.label ?? value.locale}
                </SettingsValue>
                <SettingsValue label="Timezone" mono hint={TIMEZONE_HINT}>
                  {value.timezone}
                </SettingsValue>
              </SettingsValues>
            ) : (
              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Workspace name" error={errors['name']}>
                  <Input
                    size="lg"
                    value={value.name}
                    onChange={(event) => draft.update({ name: event.target.value })}
                  />
                </Field>
                <Field label="URL" hint={URL_HINT} error={errors['url']}>
                  <Input size="lg" mono readOnly value={value.url} />
                </Field>
                <Field label="Language" error={errors['locale']}>
                  <Select
                    size="md"
                    options={LOCALES}
                    value={value.locale}
                    onChange={(event) => draft.update({ locale: event.target.value })}
                  />
                </Field>
                <Field label="Timezone" hint={TIMEZONE_HINT} error={errors['timezone']}>
                  <Select
                    size="md"
                    searchable
                    searchPlaceholder="Search timezones"
                    options={TIMEZONES.map((zone) => ({ value: zone, label: zone }))}
                    value={value.timezone}
                    onChange={(event) => draft.update({ timezone: event.target.value })}
                  />
                </Field>
              </div>
            )}
          </SettingsSection>
          <UnsavedChangesBar {...edits.bar} />
        </>
      ) : null}
    </SettingsPage>
  );
}
