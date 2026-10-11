import type { CodeHost, CodeHostKind } from '@bemmoly/shared';
import { Button, Modal } from '@bemmoly/ui';
import { useState, type ReactNode } from 'react';
import { useCodeHostForm } from '../../hooks/use-code-host-form.ts';
import { HOST_LABELS, type CodeHosts } from '../../hooks/use-code-hosts.ts';
import { serverFieldErrors } from '../../lib/errors.ts';
import { FormError } from '../form.tsx';
import { ChoiceCard } from '../setup/choice-card.tsx';
import { CopyValue } from '../sso/copy-value.tsx';
import { CredentialFields, ServerFields } from './host-fields.tsx';
import { HostMark } from './host-mark.tsx';

/** `new` picks the host; `new:<kind>` connects one; an integration id edits it. */
export type HostDialogState = string | null;

const EVENTS: Record<CodeHostKind, string> = {
  github:
    'Content type application/json. Events: pull requests, pull request reviews, pushes, branch or tag creation and deletion, check suites.',
  gitlab: 'Trigger on push events, merge request events and pipeline events.',
};

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

interface HostFormProps {
  kind: CodeHostKind;
  host: CodeHost | undefined;
  hosts: CodeHosts;
  onClose: () => void;
  onSaved: (host: CodeHost) => void;
}

function HostForm({ kind, host, hosts, onClose, onSaved }: HostFormProps) {
  const form = useCodeHostForm(kind, host);
  const [saveError, setSaveError] = useState<unknown>(null);
  const busy = hosts.creating || hosts.updating;
  const product = HOST_LABELS[kind];
  const save = async () => {
    const input = form.build();
    if (!input) return;
    setSaveError(null);
    try {
      const saved = host
        ? await hosts.update(host.id, input)
        : await hosts.create(input as Parameters<CodeHosts['create']>[0]);
      onSaved(saved);
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
      title={host ? `Edit ${host.name}` : `Connect ${product}`}
      description={`Pull requests, branches and commits that name an issue key link to that issue, with their state on the issue page.`}
      footer={
        <>
          <Button onClick={onClose}>{host ? 'Close' : 'Cancel'}</Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {host ? 'Save changes' : `Connect ${product}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Step n={1} title={`Add a webhook in ${product}`}>
          {host ? (
            <>
              <CopyValue label="Payload URL" value={host.webhookUrl} />
              <p className="m-0 text-13 leading-body text-tx-3">
                {EVENTS[kind]} Use the same secret as below.
              </p>
            </>
          ) : (
            <p className="m-0 text-13 leading-body text-tx-3">
              Connect first; the address to paste into {product} appears here.
            </p>
          )}
        </Step>
        <Step n={2} title="Where it runs">
          <ServerFields kind={kind} form={form} disabled={busy} />
        </Step>
        <Step n={3} title="API access">
          <CredentialFields kind={kind} form={form} disabled={busy} />
        </Step>
        <FormError error={saveError} />
      </div>
    </Modal>
  );
}

function KindPicker({
  onPick,
  onClose,
}: {
  onPick: (kind: CodeHostKind) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      width="md"
      onClose={onClose}
      title="Connect a code host"
      description="Cloud or your own server; one connection per account or server."
      footer={<Button onClick={onClose}>Cancel</Button>}
    >
      <div role="radiogroup" aria-label="Code host" className="grid gap-2.5 sm:grid-cols-2">
        {(['github', 'gitlab'] as const).map((kind) => (
          <ChoiceCard
            key={kind}
            initials={kind === 'github' ? 'GH' : 'GL'}
            icon={<HostMark kind={kind} />}
            name={HOST_LABELS[kind]}
            detail={kind === 'github' ? 'Cloud or Enterprise Server' : 'Cloud or self-managed'}
            selected={false}
            onSelect={() => onPick(kind)}
          />
        ))}
      </div>
    </Modal>
  );
}

interface HostDialogProps {
  state: HostDialogState;
  hosts: CodeHosts;
  onState: (state: HostDialogState) => void;
}

/** Connect and edit live in the address (`?host=…`), so reload and Back keep the dialog. */
export function HostDialog({ state, hosts, onState }: HostDialogProps) {
  if (state === null) return null;
  const close = () => onState(null);
  if (state === 'new')
    return <KindPicker onClose={close} onPick={(kind) => onState(`new:${kind}`)} />;
  if (state.startsWith('new:')) {
    const kind = state.slice(4);
    if (kind !== 'github' && kind !== 'gitlab') return null;
    return (
      <HostForm
        key={state}
        kind={kind}
        host={undefined}
        hosts={hosts}
        onClose={close}
        onSaved={(host) => onState(host.id)}
      />
    );
  }
  const host = hosts.items.find((item) => item.id === state);
  if (!host) return null;
  return (
    <HostForm
      key={host.id}
      kind={host.kind}
      host={host}
      hosts={hosts}
      onClose={close}
      onSaved={close}
    />
  );
}
