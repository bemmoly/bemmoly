import { WEBHOOK_HEADERS, WEBHOOK_SIGNATURE_TOLERANCE_SECONDS } from '@bemmoly/shared/webhooks';
import { Button, Modal } from '@bemmoly/ui';
import { Notice } from '../../../components/form.tsx';
import { CopyField } from '../../../components/settings/copy-field.tsx';
import { useClipboard } from '../../../hooks/use-clipboard.ts';

const code = 'rounded-chip bg-sunken px-1 font-mono text-12 text-tx';

/** How a receiver checks that a delivery came from this workspace and was not replayed. */
export function VerifyHint() {
  const minutes = WEBHOOK_SIGNATURE_TOLERANCE_SECONDS / 60;
  return (
    <div className="flex flex-col gap-2 text-13 leading-body text-tx-2">
      <p className="m-0">
        Every delivery carries these headers:{' '}
        {Object.values(WEBHOOK_HEADERS).map((header, index, all) => (
          <span key={header}>
            <code className={code}>{header}</code>
            {index < all.length - 1 ? ', ' : '.'}
          </span>
        ))}
      </p>
      <p className="m-0">
        The signature reads <code className={code}>t=&lt;unix seconds&gt;,v1=&lt;hex&gt;</code>.
        Compute HMAC-SHA256 of <code className={code}>{'${t}.${rawBody}'}</code> with the signing
        secret, compare it with <code className={code}>v1</code> in constant time, and refuse a{' '}
        <code className={code}>t</code> more than {minutes} minutes old.
      </p>
    </div>
  );
}

interface SecretPanelProps {
  secret: string;
  onDone: () => void;
  doneLabel?: string;
}

/** The signing secret, once: after this only its last four characters are ever shown. */
export function SecretPanel({ secret, onDone, doneLabel = 'Done' }: SecretPanelProps) {
  const clipboard = useClipboard();
  return (
    <div className="flex flex-col gap-4">
      <Notice tone="caution">
        Copy the signing secret now and store it with the receiver. It won’t be shown again; if you
        lose it, rotate it.
      </Notice>
      <CopyField
        label="Signing secret"
        value={secret}
        copied={clipboard.copied === secret}
        onCopy={() => void clipboard.copy(secret, 'Signing secret copied')}
      />
      <VerifyHint />
      <div className="flex justify-end">
        <Button variant="primary" onClick={onDone}>
          {doneLabel}
        </Button>
      </div>
    </div>
  );
}

interface SecretModalProps {
  secret: string | null;
  title: string;
  onDone: () => void;
}

export function SecretModal({ secret, title, onDone }: SecretModalProps) {
  return (
    <Modal open={secret !== null} onClose={onDone} title={title} width="lg">
      {secret ? <SecretPanel secret={secret} onDone={onDone} /> : null}
    </Modal>
  );
}
