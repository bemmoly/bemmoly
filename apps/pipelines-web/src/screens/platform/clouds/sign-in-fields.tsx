import { useT } from '@bemmoly/core-web';
import { Button, Radio } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useId, useRef, useState } from 'react';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { SIGN_INS, readCredential, type CredentialRead, type SignIn } from './attached-form.ts';

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
 * How Bemmoly signs in to Google Cloud, for both kinds of connection: the VM's account, the
 * person's gcloud sign-in, or a workload identity file read in the browser. A service account
 * key is turned away before it is sent.
 */
export function SignInFields({
  value,
  onChange,
  onCredential,
}: {
  value: SignIn;
  onChange: (signIn: SignIn) => void;
  onCredential: (file: Record<string, unknown> | null) => void;
}) {
  const t = useT(pipelinesText);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileLabel = useId();
  const [file, setFile] = useState<{ name: string; read: CredentialRead } | null>(null);
  const pick = async (files: FileList | null) => {
    const chosen = files?.[0];
    if (!chosen) return;
    const read = readCredential(await chosen.text());
    setFile({ name: chosen.name, read });
    onCredential(read.ok ? read.file : null);
  };
  return (
    <>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 font-medium text-tx">{t('pipelines.clouds.signInTitle')}</legend>
        {SIGN_INS.map((signIn) => (
          <Radio
            key={signIn}
            name="sign-in"
            checked={value === signIn}
            onChange={() => onChange(signIn)}
            label={t(SIGN_IN_LABEL[signIn])}
            description={t(SIGN_IN_HINT[signIn])}
          />
        ))}
      </fieldset>
      {value === 'workload_identity_file' && (
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
    </>
  );
}
