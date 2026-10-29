import { useT } from '@bemmoly/core-web';
import { Button, Field, Input } from '@bemmoly/ui';
import { useState, type FormEvent } from 'react';
import { useCloudWrites } from '../../../hooks/use-clouds.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { regionValid } from './attached-form.ts';
import {
  billingValid,
  folderValid,
  managedBodyOf,
  managedReady,
  projectValid,
  type ManagedDraft,
} from './managed-form.ts';
import { SignInFields } from './sign-in-fields.tsx';

/** An error only once something was typed: an empty field is not yet wrong. */
const wrong = (value: string, valid: (value: string) => boolean) =>
  value.trim().length > 0 && !valid(value);

/**
 * Google Cloud where Pipelines creates the projects: the values bootstrap.sh printed (the
 * folder it may work in, the billing account and the control project), the default region
 * and how Bemmoly signs in. Connecting checks the grant; the layout and plan come next.
 */
export function ConnectManaged({ onConnected }: { onConnected: (id: string) => void }) {
  const t = useT(pipelinesText);
  const { connect } = useCloudWrites();
  const [draft, setDraft] = useState<ManagedDraft>({
    name: t('pipelines.clouds.defaultGcpName'),
    folderId: '',
    billingAccountId: '',
    controlProject: '',
    region: 'us-central1',
    signIn: 'vm',
    credentialFile: null,
  });
  const set = (patch: Partial<ManagedDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const ready = managedReady(draft);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || connect.isPending) return;
    connect.mutate(managedBodyOf(draft), { onSuccess: ({ id }) => onConnected(id) });
  };
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3.5 rounded-card border border-line bg-card p-4 shadow-e1"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-16 font-semibold text-tx">{t('pipelines.clouds.managedTitle')}</h2>
        <p className="text-12 text-tx-2">{t('pipelines.clouds.managedIntro')}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t('pipelines.clouds.name')}>
          <Input value={draft.name} onChange={(event) => set({ name: event.target.value })} />
        </Field>
        <Field
          label={t('pipelines.clouds.folderId')}
          hint={t('pipelines.clouds.folderIdHint')}
          error={wrong(draft.folderId, folderValid) ? t('pipelines.clouds.folderIdInvalid') : null}
        >
          <Input
            mono
            inputMode="numeric"
            value={draft.folderId}
            placeholder={t('pipelines.clouds.folderIdExample')}
            onChange={(event) => set({ folderId: event.target.value.trim() })}
          />
        </Field>
        <Field
          label={t('pipelines.clouds.billing')}
          hint={t('pipelines.clouds.billingHint')}
          error={
            wrong(draft.billingAccountId, billingValid)
              ? t('pipelines.clouds.billingInvalid')
              : null
          }
        >
          <Input
            mono
            value={draft.billingAccountId}
            placeholder={t('pipelines.clouds.billingExample')}
            onChange={(event) => set({ billingAccountId: event.target.value.trim() })}
          />
        </Field>
        <Field
          label={t('pipelines.clouds.controlProject')}
          hint={t('pipelines.clouds.controlProjectHint')}
          error={
            wrong(draft.controlProject, projectValid)
              ? t('pipelines.clouds.projectIdInvalid')
              : null
          }
        >
          <Input
            mono
            value={draft.controlProject}
            placeholder={t('pipelines.clouds.controlProjectExample')}
            onChange={(event) => set({ controlProject: event.target.value.trim() })}
          />
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
      <p className="text-12 text-tx-3">{t('pipelines.clouds.keyless')}</p>
      <ActionError error={connect.error} />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!ready} loading={connect.isPending}>
          {t('pipelines.clouds.connectAndCheck')}
        </Button>
      </div>
    </form>
  );
}
