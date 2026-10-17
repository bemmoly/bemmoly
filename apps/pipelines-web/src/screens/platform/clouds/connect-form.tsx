import { ApiError } from '@bemmoly/api-client';
import { useT } from '@bemmoly/core-web';
import type { ConnectCloudBody, Provider } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input } from '@bemmoly/ui';
import { useState, type FormEvent } from 'react';
import { useCloudWrites } from '../../../hooks/use-clouds.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { refusalOf } from '../../../parts/load-failed.tsx';

const ORGANISATION = /^[0-9]{6,20}$/;
const BILLING = /^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/;

/**
 * What a provider needs to be reached: for Google Cloud the organisation, the billing account
 * and the folder to work inside; for this machine only Docker. No key files are asked for.
 */
export function ConnectForm({
  provider,
  onConnected,
}: {
  provider: Provider;
  onConnected: (id: string) => void;
}) {
  const t = useT(pipelinesText);
  const { connect } = useCloudWrites();
  const gcp = provider === 'gcp';
  const [name, setName] = useState(
    gcp ? t('pipelines.clouds.defaultGcpName') : t('pipelines.clouds.defaultLocalName'),
  );
  const [organization, setOrganization] = useState('');
  const [billing, setBilling] = useState('');
  const [folder, setFolder] = useState('Bemmoly');
  const orgError =
    organization && !ORGANISATION.test(organization) ? t('pipelines.clouds.orgInvalid') : null;
  const billingError =
    billing && !BILLING.test(billing.toUpperCase()) ? t('pipelines.clouds.billingInvalid') : null;
  const ready =
    name.trim() &&
    (!gcp || (ORGANISATION.test(organization) && BILLING.test(billing.toUpperCase())));
  const failure = connect.error
    ? (refusalOf(connect.error)?.sentence ??
      (connect.error instanceof ApiError
        ? connect.error.message
        : t('pipelines.common.loadFailed')))
    : null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    const body: ConnectCloudBody = gcp
      ? {
          provider: 'gcp',
          name: name.trim(),
          organizationId: organization,
          billingAccountId: billing.toUpperCase(),
          folderName: folder.trim() || 'Bemmoly',
        }
      : { provider: 'local', name: name.trim() };
    connect.mutate(body, { onSuccess: ({ id }) => onConnected(id) });
  };
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3.5 rounded-card border border-line bg-card p-4 shadow-e1"
    >
      <h2 className="text-16 font-semibold text-tx">{t('pipelines.clouds.detailsTitle')}</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t('pipelines.clouds.name')}>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        {gcp && (
          <>
            <Field label={t('pipelines.clouds.folder')} hint={t('pipelines.clouds.folderHint')}>
              <Input value={folder} onChange={(event) => setFolder(event.target.value)} />
            </Field>
            <Field
              label={t('pipelines.clouds.organization')}
              error={orgError}
              hint={t('pipelines.clouds.organizationHint')}
            >
              <Input
                value={organization}
                inputMode="numeric"
                onChange={(event) => setOrganization(event.target.value.trim())}
              />
            </Field>
            <Field
              label={t('pipelines.clouds.billing')}
              error={billingError}
              hint={t('pipelines.clouds.billingHint')}
            >
              <Input value={billing} onChange={(event) => setBilling(event.target.value.trim())} />
            </Field>
          </>
        )}
      </div>
      {gcp && <p className="text-12 text-tx-3">{t('pipelines.clouds.keyless')}</p>}
      {failure && (
        <p role="alert" className="rounded-control bg-red-50 px-3 py-2 text-12 text-red-tx">
          {failure}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!ready} loading={connect.isPending}>
          {t('pipelines.clouds.connectAndPreview')}
        </Button>
      </div>
    </form>
  );
}
