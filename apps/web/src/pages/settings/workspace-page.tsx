import { BUTTON } from '../../components/button-sizes.ts';
import { Field } from '../../components/form.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { LOCALES, TIMEZONES, useWorkspaceSettings } from '../../hooks/use-workspace-settings.ts';
import { Button, Card, Input, Select } from '../../ui.ts';

export function WorkspacePage() {
  const { settings, draft, errors, submit } = useWorkspaceSettings();
  const value = draft.value;
  return (
    <SettingsPage
      title="Workspace details"
      subtitle="The name and address everyone sees, and the defaults for dates and times."
      loading={settings.isPending}
      error={settings.error}
      actions={
        <>
          <Button
            variant="secondary"
            className={BUTTON.secondary}
            disabled={!draft.dirty}
            onClick={draft.discard}
          >
            Discard
          </Button>
          <Button
            variant="primary"
            className={BUTTON.primary}
            type="submit"
            form="workspace-form"
            disabled={!draft.dirty || settings.save.isPending}
          >
            Save
          </Button>
        </>
      }
    >
      {value ? (
        <form id="workspace-form" onSubmit={submit} noValidate>
          <Card className="grid grid-cols-2 gap-3.5 p-5">
            <Field label="Workspace name" error={errors['name']}>
              <Input
                value={value.name}
                onChange={(event) => draft.update({ name: event.target.value })}
              />
            </Field>
            <Field
              label="URL"
              hint="Set by BEMMOLY_PUBLIC_URL on the server."
              error={errors['url']}
            >
              <Input mono readOnly value={value.url} />
            </Field>
            <Field label="Language" error={errors['locale']}>
              <Select
                size="md"
                options={LOCALES}
                value={value.locale}
                onChange={(event) => draft.update({ locale: event.target.value })}
              />
            </Field>
            <Field
              label="Timezone"
              hint="Backups and digests run on this clock."
              error={errors['timezone']}
            >
              <Select
                size="md"
                options={TIMEZONES.map((zone) => ({ value: zone, label: zone }))}
                value={value.timezone}
                onChange={(event) => draft.update({ timezone: event.target.value })}
              />
            </Field>
          </Card>
        </form>
      ) : null}
    </SettingsPage>
  );
}
