import { useT } from '@bemmoly/core-web';
import { Button, Field, Input, Radio } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useCloudWrites } from '../../../hooks/use-clouds.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import {
  SIGN_INS,
  attachedBodyOf,
  attachedReady,
  readCredential,
  regionValid,
  registryValid,
  type AttachedDraft,
  type CredentialRead,
} from './attached-form.ts';

export const SIGN_IN_LABEL = {
  vm: 'pipelines.clouds.signIn.vm',
  application_default: 'pipelines.clouds.signIn.applicationDefault',
  workload_identity_file: 'pipelines.clouds.signIn.workloadIdentityFile',
} as const;

const SIGN_IN_HINT = {
  vm: 'pipelines.clouds.signInHint.vm',
  application_default: 'pipelines.clouds.signInHint.applicationDefault',
  workload_identity_file: 'pipelines.clouds.signInHint.workloadIdentityFile',
} as const;

const FILE_PROBLEM = {
  not_json: 'pipelines.clouds.fileNotJson',
  service_account_key: 'pipelines.clouds.fileIsKey',
  not_federation: 'pipelines.clouds.fileNotFederation',
} as const;

/**
 * Google Cloud with projects that exist already: a name, the region services go to when an
 * environment names none, how Bemmoly signs in, and where runners push images. Nothing is
 * created, so there is no layout and no preview; projects are attached on the next screen.
 */
export function ConnectAttached({ onConnected }: { onConnected: (id: string) => void }) {
  const t = useT(pipelinesText);
  const { connect } = useCloudWrites();
  const fileInput = useRef<HTMLInputElement>(null);
  const fileLabel = useId();
  const [draft, setDraft] = useState<AttachedDraft>({
    name: t('pipelines.clouds.defaultGcpName'),
    region: 'us-central1',
    signIn: 'vm',
    credentialFile: null,
    registry: '',
  });
  const [file, setFile] = useState<{ name: string; read: CredentialRead } | null>(null);
  const set = (patch: Partial<AttachedDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const pick = async (files: FileList | null) => {
    const chosen = files?.[0];
    if (!chosen) return;
    const read = readCredential(await chosen.text());
    setFile({ name: chosen.name, read });
    set({ credentialFile: read.ok ? read.file : null });
  };
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
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 font-medium text-tx">{t('pipelines.clouds.signInTitle')}</legend>
        {SIGN_INS.map((signIn) => (
          <Radio
            key={signIn}
            name="sign-in"
            checked={draft.signIn === signIn}
            onChange={() => set({ signIn })}
            label={t(SIGN_IN_LABEL[signIn])}
            description={t(SIGN_IN_HINT[signIn])}
          />
        ))}
      </fieldset>
      {draft.signIn === 'workload_identity_file' && (
        <div className="flex flex-col gap-1.5 ps-6">
          <span id={fileLabel} className="font-medium text-tx">
            {t('pipelines.clouds.fileLabel')}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<Icon name="upload" size={14} />}
              onClick={() => fileInput.current?.click()}
            >
              {file ? t('pipelines.clouds.fileReplace') : t('pipelines.clouds.fileChoose')}
            </Button>
            {file && <span className="truncate font-mono text-12 text-tx-2">{file.name}</span>}
          </span>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-labelledby={fileLabel}
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              void pick(event.target.files);
              event.target.value = '';
            }}
          />
          <span className={file && !file.read.ok ? 'text-12 text-red-tx' : 'text-12 text-tx-3'}>
            {file && !file.read.ok
              ? t(FILE_PROBLEM[file.read.reason])
              : t('pipelines.clouds.fileHint')}
          </span>
        </div>
      )}
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
