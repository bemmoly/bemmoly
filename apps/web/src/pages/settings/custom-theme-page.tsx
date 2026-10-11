import { Button, ConfirmChange, Input, SegmentedControl } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { SURFACE_STYLE_IDS, SURFACE_STYLES } from '@bemmoly/ui/theme';
import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { BrandColorField } from '../../components/appearance/brand-color-field.tsx';
import { RampCard } from '../../components/appearance/ramp-card.tsx';
import { Notice } from '../../components/form.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import {
  BRAND_SWATCHES,
  useCustomThemeEditor,
  type CustomThemeEditor,
} from '../../hooks/use-custom-theme-editor.ts';

const SURFACES = SURFACE_STYLE_IDS.map((id) => ({ value: id, label: SURFACE_STYLES[id].name }));

/** The amber note for a brand in a reserved hue: a warning, never a block (ADR 0021). */
function HueWarning({ editor }: { editor: CustomThemeEditor }) {
  const { guard, light } = editor.built;
  if (!guard) return null;
  return (
    <div
      role="note"
      className="flex gap-2.5 rounded-card border border-amber bg-amber-50 px-3.5 py-3 text-13 text-tx"
    >
      <Icon name="warning" className="shrink-0 text-amber-tx" />
      <span>
        <b className="font-semibold">
          {editor.brand} is close to {guard.means}.
        </b>{' '}
        You can still use it: warnings and errors always carry an icon and their own colour, and
        buttons use the darker {light['acc-fill']} so they stay readable. A blue, teal or neutral
        brand avoids the overlap entirely.
      </span>
    </div>
  );
}

function Fields({ editor }: { editor: CustomThemeEditor }) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        <label htmlFor="theme-name" className="font-medium">
          Name
        </label>
        <Input
          id="theme-name"
          value={editor.name}
          maxLength={40}
          placeholder="Acme"
          aria-invalid={editor.nameError && editor.name !== '' ? true : undefined}
          onChange={(event) => editor.setName(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span id="theme-surface" className="font-medium">
          Surfaces
        </span>
        <SegmentedControl
          aria-labelledby="theme-surface"
          className="w-60"
          options={SURFACES}
          value={editor.surface}
          onChange={editor.setSurface}
        />
      </div>
      <div className="md:col-span-2">
        <BrandColorField
          brand={editor.brand}
          swatches={BRAND_SWATCHES}
          hex={editor.hex}
          onPick={editor.pick}
        />
      </div>
      {editor.isNew && editor.canManage && editor.allowPersonal ? (
        <div className="flex flex-col gap-2 md:col-span-2">
          <span id="theme-scope" className="font-medium">
            Who can use it
          </span>
          <SegmentedControl
            aria-labelledby="theme-scope"
            className="w-80"
            options={[
              { value: 'workspace', label: 'Everyone' },
              { value: 'personal', label: 'Just me' },
            ]}
            value={editor.scope}
            onChange={editor.setScope}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Settings › Appearance › Brand colour: one hex in, two checked themes out. */
export function CustomThemePage() {
  const { themeId } = useParams({ strict: false }) as { themeId?: string };
  const editor = useCustomThemeEditor(themeId ?? null);
  const [confirming, setConfirming] = useState(false);
  const title = editor.isNew ? 'Your brand colour' : `Edit ${editor.name || 'theme'}`;
  return (
    <SettingsPage
      breadcrumb
      title={title}
      description="Enter one colour. Bemmoly builds a light and a dark version, adjusts each until text and buttons pass contrast, and never touches the logo, AI, issue types or statuses."
      actions={
        <>
          {!editor.isNew && editor.mayEdit ? (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          ) : null}
          <Button
            variant="primary"
            disabled={!editor.canSave}
            loading={editor.save.isPending}
            onClick={() => editor.save.mutate()}
          >
            {editor.isNew ? 'Save theme' : 'Save changes'}
          </Button>
        </>
      }
    >
      {editor.missing ? (
        <Notice tone="caution">This theme was deleted, or it is someone else’s.</Notice>
      ) : !editor.mayEdit ? (
        <Notice tone="caution">
          Your workspace does not let people make their own themes. Ask an admin to turn on personal
          themes in Settings › Appearance.
        </Notice>
      ) : (
        <div className="flex max-w-260 flex-col gap-4">
          <Fields editor={editor} />
          <HueWarning editor={editor} />
          <div className="grid gap-4 md:grid-cols-2">
            <RampCard source={editor.source} mode="light" checks={editor.built.checks.light} />
            <RampCard source={editor.source} mode="dark" checks={editor.built.checks.dark} />
          </div>
          <p className="m-0 text-12 text-tx-3">
            Surfaces come from a built-in theme. Brand-tinted surfaces are gone: they made dark mode
            muddy and halved the contrast budget.
          </p>
          <ConfirmChange
            open={confirming}
            title={`Delete ${editor.name}?`}
            consequences={[
              'Anyone using it goes back to the workspace theme.',
              'This cannot be undone.',
            ]}
            confirmLabel="Delete theme"
            tone="danger"
            busy={editor.remove.isPending}
            onConfirm={() => editor.remove.mutate()}
            onCancel={() => setConfirming(false)}
          />
        </div>
      )}
    </SettingsPage>
  );
}
