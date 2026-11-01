import { useT } from '@bemmoly/core-web';
import { Button, Field, Input } from '@bemmoly/ui';
import { useState, type FormEvent } from 'react';
import { useCloudWrites } from '../../../hooks/use-clouds.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';

/**
 * This machine's Docker: only a name, since the socket defaults to the usual one. Google
 * Cloud has its own forms (connect-managed and connect-attached).
 */
export function ConnectForm({ onConnected }: { onConnected: (id: string) => void }) {
  const t = useT(pipelinesText);
  const { connect } = useCloudWrites();
  const [name, setName] = useState(t('pipelines.clouds.defaultLocalName'));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    connect.mutate(
      { provider: 'local', name: name.trim() },
      { onSuccess: ({ id }) => onConnected(id) },
    );
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
      </div>
      <ActionError error={connect.error} />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!name.trim()} loading={connect.isPending}>
          {t('pipelines.clouds.connectAndPreview')}
        </Button>
      </div>
    </form>
  );
}
