import type { SsoProvider } from '@bemmoly/shared';
import { Button, Modal } from '@bemmoly/ui';
import { useState, type ReactNode } from 'react';
import type { SsoProviders } from '../../hooks/use-sso-admin.ts';
import { useSsoProviderForm } from '../../hooks/use-sso-provider-form.ts';
import { serverFieldErrors } from '../../lib/errors.ts';
import { presetFor, SSO_PRESETS, type SsoPreset } from '../../lib/sso-presets.ts';
import { FormError } from '../form.tsx';
import { ChoiceCard } from '../setup/choice-card.tsx';
import { AccessFields } from './access-fields.tsx';
import { ServiceProviderValues } from './copy-value.tsx';
import { ProviderFields } from './provider-fields.tsx';
import { SsoMark } from './sso-mark.tsx';

/** `new` picks a preset; `new:<preset>` adds one; a provider id edits it. */
export type ProviderDialogState = string | null;

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h3 className="m-0 flex items-center gap-2 text-13 font-semibold text-tx">
        <span className="flex size-5 items-center justify-center rounded-full bg-sunken text-11 text-tx-2">
          {n}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Step one: which identity provider, as quiet cards; every one uses the same generic form. */
function PresetPicker({ onPick }: { onPick: (preset: SsoPreset) => void }) {
  return (
    <div role="radiogroup" aria-label="Identity provider" className="grid gap-2.5 sm:grid-cols-2">
      {SSO_PRESETS.map((preset) => (
        <ChoiceCard
          key={preset.id}
          initials={preset.name.slice(0, 2)}
          icon={<SsoMark preset={preset} />}
          name={preset.name}
          detail={preset.protocol === 'oidc' ? 'OpenID Connect' : 'SAML 2.0'}
          selected={false}
          onSelect={() => onPick(preset)}
        />
      ))}
    </div>
  );
}

interface ProviderFormProps {
  preset: SsoPreset;
  provider: SsoProvider | undefined;
  providers: SsoProviders;
  onClose: () => void;
  onSaved: (row: SsoProvider) => void;
}

function ProviderForm({ preset, provider, providers, onClose, onSaved }: ProviderFormProps) {
  const form = useSsoProviderForm(preset, provider);
  const [saveError, setSaveError] = useState<unknown>(null);
  const busy = providers.creating || providers.updating;
  const save = async () => {
    const input = form.build();
    if (!input) return;
    setSaveError(null);
    try {
      const row = provider
        ? await providers.update(provider.id, input)
        : await providers.create(input);
      onSaved(row);
    } catch (error) {
      form.setErrors(serverFieldErrors(error));
      setSaveError(error);
    }
  };
  return (
    <Modal
      open
      width="lg"
      onClose={onClose}
      title={provider ? `Edit ${provider.displayName}` : `Add ${preset.name}`}
      description={preset.help}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {provider ? (
            <Button
              loading={providers.testing === provider.id}
              onClick={() => providers.test(provider.id)}
            >
              Test sign-in
            </Button>
          ) : null}
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {provider ? 'Save changes' : 'Add provider'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Step n={1} title="In your identity provider">
          {provider ? (
            <ServiceProviderValues protocol={preset.protocol} values={provider.serviceProvider} />
          ) : (
            <p className="m-0 text-13 leading-body text-tx-3">
              Add the provider first; its redirect address for your identity provider appears here.
            </p>
          )}
        </Step>
        <Step n={2} title="From your identity provider">
          <ProviderFields preset={preset} form={form} editing={Boolean(provider)} disabled={busy} />
        </Step>
        <Step n={3} title="Who can sign in">
          <AccessFields form={form} disabled={busy} />
        </Step>
        <FormError error={saveError} />
      </div>
    </Modal>
  );
}

interface ProviderDialogProps {
  state: ProviderDialogState;
  providers: SsoProviders;
  onState: (next: ProviderDialogState) => void;
}

/** Add or edit an identity provider, kept in the address so reload and Back return to it. */
export function ProviderDialog({ state, providers, onState }: ProviderDialogProps) {
  if (!state) return null;
  const close = () => onState(null);
  if (state === 'new') {
    return (
      <Modal
        open
        width="lg"
        onClose={close}
        title="Add an identity provider"
        description="Choose yours; any other standards-based one works through the generic options."
      >
        <PresetPicker onPick={(preset) => onState(`new:${preset.id}`)} />
      </Modal>
    );
  }
  if (state.startsWith('new:')) {
    const preset = SSO_PRESETS.find((item) => item.id === state.slice(4));
    if (!preset) return null;
    return (
      <ProviderForm
        key={state}
        preset={preset}
        provider={undefined}
        providers={providers}
        onClose={close}
        onSaved={(row) => onState(row.id)}
      />
    );
  }
  const provider = providers.items.find((item) => item.id === state);
  if (!provider) return null;
  return (
    <ProviderForm
      key={`${provider.id}:${provider.updatedAt}`}
      preset={presetFor(provider)}
      provider={provider}
      providers={providers}
      onClose={close}
      onSaved={() => undefined}
    />
  );
}
