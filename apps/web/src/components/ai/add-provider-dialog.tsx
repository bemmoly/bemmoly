import type { AiProvider } from '@bemmoly/shared';
import { Button, Modal } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useEffect, useId, useState } from 'react';
import { useAiCatalog, type CatalogProvider } from '../../hooks/use-ai-catalog.ts';
import { useConnection } from '../../hooks/use-ai-connection.ts';
import { useSearchParam } from '../../hooks/use-search-param.ts';
import { ConnectionForm } from './connection-form.tsx';
import { ProviderPicker } from './provider-picker.tsx';

/** The address value while the dialog is on its first step, before a provider is picked. */
export const PICKING = 'pick';

function ConnectStep({
  provider,
  formId,
  onConnected,
  onPending,
}: {
  provider: CatalogProvider;
  formId: string;
  onConnected: (row: AiProvider) => void;
  /** The footer's Connect button lives in the dialog, so it hears about progress from here. */
  onPending: (pending: boolean) => void;
}) {
  const connection = useConnection(provider, onConnected);
  const pending = connection.connect.pending;
  useEffect(() => onPending(pending), [onPending, pending]);
  return <ConnectionForm connection={connection} id={formId} />;
}

interface AddProviderDialogProps {
  /** After a provider is stored: Settings tests it and points at the roles. */
  onConnected: (row: AiProvider) => void;
}

/**
 * Add provider, in two steps that live in the address (`?add=pick`, then `?add=<catalog id>`):
 * pick from the Popular row or the whole catalog, then fill the form the catalog entry
 * generates and connect. A sheet on phones.
 */
export function AddProviderDialog({ onConnected }: AddProviderDialogProps) {
  const [add, setAdd] = useSearchParam('add');
  const [query, setQuery] = useState('');
  const catalog = useAiCatalog(query);
  const formId = useId();
  const [connecting, setConnecting] = useState(false);
  const open = add !== null;
  const picked = add && add !== PICKING ? catalog.find(add) : null;
  const close = () => setAdd(null);
  const connected = (row: AiProvider) => {
    setConnecting(false);
    setAdd(null, true);
    onConnected(row);
  };
  const footer = picked ? (
    <>
      <Button variant="ghost" icon={<Icon name="back" />} onClick={() => setAdd(PICKING, true)}>
        Choose another
      </Button>
      <span className="flex-1" />
      <Button onClick={close}>Cancel</Button>
      <Button variant="primary" type="submit" form={formId} loading={connecting}>
        Connect provider
      </Button>
    </>
  ) : (
    <Button onClick={close}>Cancel</Button>
  );
  return (
    <Modal
      open={open}
      onClose={close}
      width="lg"
      title={picked ? `Connect ${picked.name}` : 'Add a provider'}
      description={
        picked
          ? 'Keys are encrypted with this install’s secret key and are never shown again.'
          : 'Any provider in the catalog, or a model server on your own network.'
      }
      footer={footer}
    >
      {picked ? (
        <ConnectStep
          key={picked.id}
          provider={picked}
          formId={formId}
          onConnected={connected}
          onPending={setConnecting}
        />
      ) : open ? (
        <ProviderPicker
          catalog={catalog}
          query={query}
          onQuery={setQuery}
          choice={null}
          onPick={(id) => setAdd(id)}
        />
      ) : null}
    </Modal>
  );
}
