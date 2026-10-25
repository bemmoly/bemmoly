import {
  Field,
  Input,
  Select,
  SettingsRow,
  SettingsSection,
  SettingsValue,
  SettingsValues,
  Switch,
  UnsavedChangesBar,
} from '@bemmoly/ui';
import { timezoneOptions } from '../../lib/timezones.ts';
import { UrlHint } from '../../components/settings/change-url-dialog.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { useSectionEdits } from '../../components/settings/use-section-edits.ts';
import { useLinkPreviews } from '../../hooks/use-link-previews.ts';
import { LOCALES, useWorkspaceSettings } from '../../hooks/use-workspace-settings.ts';

const TIMEZONE_HINT = 'Backups and digests run on this clock.';

export function WorkspacePage() {
  const { settings, draft, errors, save, discard } = useWorkspaceSettings();
  const previews = useLinkPreviews();
  const edits = useSectionEdits({
    workspace: { title: 'Workspace', dirty: draft.dirty, discard },
  });
  const value = draft.value;
  const reading = edits.mode('workspace') === 'read';
  return (
    <SettingsPage
      title="General"
      description="The name and address everyone sees, the defaults for dates and times, and what shared links show."
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
                <SettingsValue label="URL" mono hint={<UrlHint />}>
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
                <Field label="URL" hint={<UrlHint />} error={errors['url']}>
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
                    options={timezoneOptions(value.timezone)}
                    value={value.timezone}
                    onChange={(event) => draft.update({ timezone: event.target.value })}
                  />
                </Field>
              </div>
            )}
          </SettingsSection>
          <SettingsSection title="Sharing" layout="rows">
            <SettingsRow
              title="Show titles in link previews"
              description="When someone pastes a link to a page or issue into a chat app, the preview shows its title and this workspace’s name. Anyone who has the link sees them, without signing in. Turn this off to show only “Bemmoly”."
              control={
                <Switch
                  aria-label="Show titles in link previews"
                  checked={previews.enabled}
                  disabled={previews.loading || previews.pending}
                  onCheckedChange={previews.setEnabled}
                />
              }
            />
          </SettingsSection>
          <UnsavedChangesBar {...edits.bar} />
        </>
      ) : null}
    </SettingsPage>
  );
}
