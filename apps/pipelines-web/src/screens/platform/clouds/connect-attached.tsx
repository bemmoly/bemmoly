import { useT } from '@bemmoly/core-web';
import { Button, Field, Input } from '@bemmoly/ui';
import { useState, type FormEvent } from 'react';
import { useCloudWrites } from '../../../hooks/use-clouds.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import {
  attachedBodyOf,
  attachedReady,
  regionValid,
  registryValid,
  type AttachedDraft,
} from './attached-form.ts';
import { SignInFields } from './sign-in-fields.tsx';

/**
 * Google Cloud with projects that exist already: a name, the region services go to when an
 * environment names none, how Bemmoly signs in, and where runners push images. Nothing is
 * created, so there is no layout and no preview; projects are attached on the next screen.
 */
export function ConnectAttached({ onConnected }: { onConnected: (id: string) => void }) {
  const t = useT(pipelinesText);
  const { connect } = useCloudWrites();
  const [draft, setDraft] = useState<AttachedDraft>({
    name: t('pipelines.clouds.defaultGcpName'),
    region: 'us-central1',
    signIn: 'vm',
    credentialFile: null,
    registry: '',
  });
  const set = (patch: Partial<AttachedDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const ready = attachedReady(draft);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || connect.isPending) return;
    connect.mutate(attachedBodyOf(draft), { onSuccess: ({ id }) => onConnected(id) });
  };
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3.5 rounded-card border border-line bg-card p-4 shadow-e1"
    >
      <h2 className="text-16 font-semibold text-tx">{t('pipelines.clouds.attachedTitle')}</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t('pipelines.clouds.name')}>
          <Input value={draft.name} onChange={(event) => set({ name: event.target.value })} />
        </Field>
        <Field
          label={t('pipelines.clouds.region')}
          hint={t('pipelines.clouds.regionHint')}
          error={regionValid(draft.region) ? null : t('pipelines.clouds.regionInvalid')}
        >
          <Input
            mono
            value={draft.region}
            onChange={(event) => set({ region: event.target.value.trim() })}
          />
        </Field>
      </div>
      <SignInFields
        value={draft.signIn}
        onChange={(signIn) => set({ signIn })}
        onCredential={(credentialFile) => set({ credentialFile })}
      />
      <Field
        label={t('pipelines.clouds.registry')}
        hint={t('pipelines.clouds.registryHint')}
        error={registryValid(draft.registry) ? null : t('pipelines.clouds.registryInvalid')}
      >
        <Input
          mono
          value={draft.registry}
          placeholder={t('pipelines.clouds.registryExample')}
          onChange={(event) => set({ registry: event.target.value })}
        />
      </Field>
      <ActionError error={connect.error} />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!ready} loading={connect.isPending}>
          {t('pipelines.clouds.connectAttached')}
        </Button>
      </div>
    </form>
  );
}
