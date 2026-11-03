import { useT } from '@bemmoly/core-web';
import { Button, Card, CardBody, CardHeader, Radio } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useId, useRef, useState } from 'react';
import { setupText } from '../../../i18n/catalog.ts';
import { readCredential, type CredentialRead } from '../../platform/clouds/attached-form.ts';
import type { ConnectCloud, SignInChoice } from './use-connect-cloud.ts';
import { WifGuide } from './wif-guide.tsx';

const CHOICES = [
  ['vm', 'pipelinesSetup.cloud.signIn.vm', 'pipelinesSetup.cloud.signIn.vmHint'],
  [
    'application_default',
    'pipelinesSetup.cloud.signIn.gcloud',
    'pipelinesSetup.cloud.signIn.gcloudHint',
  ],
  [
    'workload_identity_file',
    'pipelinesSetup.cloud.signIn.wif',
    'pipelinesSetup.cloud.signIn.wifHint',
  ],
] as const satisfies readonly (readonly [SignInChoice, string, string])[];

const FILE_PROBLEM = {
  not_json: 'pipelinesSetup.wif.notJson',
  service_account_key: 'pipelinesSetup.wif.isKey',
  not_federation: 'pipelinesSetup.wif.notFederation',
} as const;

const CONSOLE_POOLS = 'https://console.cloud.google.com/iam-admin/workload-identity-pools';

/** How Bemmoly signs in: nothing is picked for the person; a file is read in the browser. */
export function SignInCard({ flow }: { flow: ConnectCloud }) {
  const t = useT(setupText);
  const input = useRef<HTMLInputElement>(null);
  const fileLabel = useId();
  const [file, setFile] = useState<{ name: string; read: CredentialRead } | null>(null);
  const pick = async (files: FileList | null) => {
    const chosen = files?.[0];
    if (!chosen) return;
    const read = readCredential(await chosen.text());
    setFile({ name: chosen.name, read });
    flow.setCredentialFile(read.ok ? read.file : null);
  };
  return (
    <Card>
      <CardHeader
        title={<h2 className="text-15 font-semibold">{t('pipelinesSetup.cloud.signInTitle')}</h2>}
      />
      <CardBody className="flex flex-col gap-2.5">
        <fieldset
          aria-label={t('pipelinesSetup.cloud.signInTitle')}
          className="flex flex-col gap-2.5"
        >
          {CHOICES.map(([value, label, hint]) => (
            <Radio
              key={value}
              name="sign-in"
              checked={flow.signIn === value}
              onChange={() => flow.setSignIn(value)}
              label={t(label)}
              description={t(hint)}
            />
          ))}
        </fieldset>
        {flow.signIn === 'workload_identity_file' && (
          <div className="flex flex-col gap-3 ps-6">
            <div className="flex flex-col gap-1.5">
              <span id={fileLabel} className="font-medium text-tx">
                {t('pipelinesSetup.wif.fileLabel')}
              </span>
              <span className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  icon={<Icon name="upload" size={14} />}
                  onClick={() => input.current?.click()}
                >
                  {file ? t('pipelinesSetup.wif.replace') : t('pipelinesSetup.wif.choose')}
                </Button>
                {file && <span className="truncate font-mono text-12 text-tx-2">{file.name}</span>}
                <a
                  href={CONSOLE_POOLS}
                  target="_blank"
                  rel="noreferrer"
                  className="text-12 font-medium text-acc"
                >
                  {t('pipelinesSetup.wif.consoleLink')}
                </a>
              </span>
              <input
                ref={input}
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
              {file && !file.read.ok && (
                <span className="text-12 text-red-tx">{t(FILE_PROBLEM[file.read.reason])}</span>
              )}
            </div>
            <WifGuide />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
