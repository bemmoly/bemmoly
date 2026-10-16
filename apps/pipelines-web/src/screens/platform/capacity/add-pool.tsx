import { ApiError } from '@bemmoly/api-client';
import { useT } from '@bemmoly/core-web';
import { poolHostingSchema, type PoolHosting } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Modal, Select } from '@bemmoly/ui';
import { useState } from 'react';
import { usePoolWrites } from '../../../hooks/use-capacity.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { refusalOf } from '../../../parts/load-failed.tsx';
import { TokenReveal } from './token-reveal.tsx';

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);

/** A new runner pool: where it runs and how far it scales; its token is shown once after. */
export function AddPool({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT(pipelinesText);
  const { create } = usePoolWrites();
  const [name, setName] = useState('');
  const [hosting, setHosting] = useState<PoolHosting>('kubernetes');
  const [location, setLocation] = useState('');
  const [min, setMin] = useState('0');
  const [max, setMax] = useState('10');
  const key = slug(name);
  const ready = key.length > 0 && Number(max) >= Math.max(1, Number(min));
  const error = create.error
    ? (refusalOf(create.error)?.sentence ??
      (create.error instanceof ApiError ? create.error.message : t('pipelines.common.loadFailed')))
    : null;
  const close = () => {
    create.reset();
    setName('');
    onClose();
  };
  const token = create.data?.token.token;
  return (
    <Modal
      open={open}
      onClose={close}
      title={token ? t('pipelines.capacity.poolAdded', { name }) : t('pipelines.capacity.addPool')}
      description={token ? undefined : t('pipelines.capacity.addPoolDescription')}
      footer={
        token ? (
          <Button variant="primary" onClick={close}>
            {t('pipelines.capacity.done')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              {t('pipelines.common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!ready}
              loading={create.isPending}
              onClick={() =>
                create.mutate({
                  key,
                  name: name.trim(),
                  hosting,
                  ...(location.trim() ? { location: location.trim() } : {}),
                  minRunners: Number(min),
                  maxRunners: Number(max),
                })
              }
            >
              {t('pipelines.capacity.addPool')}
            </Button>
          </>
        )
      }
    >
      {token ? (
        <TokenReveal token={token} />
      ) : (
        <div className="flex flex-col gap-3.5">
          <Field
            label={t('pipelines.capacity.poolName')}
            hint={key ? t('pipelines.capacity.poolKey', { key }) : undefined}
          >
            <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('pipelines.capacity.hosting')}>
              <Select
                value={hosting}
                options={poolHostingSchema.options.map((value) => ({
                  value,
                  label: t(`pipelines.hosting.${value}`),
                }))}
                onChange={(event) => setHosting(event.value as PoolHosting)}
              />
            </Field>
            <Field label={t('pipelines.capacity.location')}>
              <Input
                value={location}
                placeholder={t('pipelines.capacity.locationExample')}
                onChange={(event) => setLocation(event.target.value)}
              />
            </Field>
            <Field label={t('pipelines.capacity.minRunners')}>
              <Input
                type="number"
                min={0}
                value={min}
                onChange={(event) => setMin(event.target.value)}
              />
            </Field>
            <Field label={t('pipelines.capacity.maxRunners')}>
              <Input
                type="number"
                min={1}
                value={max}
                onChange={(event) => setMax(event.target.value)}
              />
            </Field>
          </div>
          {error && (
            <p role="alert" className="rounded-control bg-red-50 px-3 py-2 text-12 text-red-tx">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
