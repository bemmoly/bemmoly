import { Button, Modal } from '@bemmoly/ui';
import { useState } from 'react';

const COMMAND = 'sudo bemmoly domain set new.example.com';

/** "Set by BEMMOLY_PUBLIC_URL on the server. How to change": the URL hint, with its guide. */
export function UrlHint() {
  const [open, setOpen] = useState(false);
  return (
    <>
      Set by BEMMOLY_PUBLIC_URL on the server.{' '}
      <button
        type="button"
        className="cursor-pointer border-0 bg-transparent p-0 text-ac hover:underline"
        onClick={() => setOpen(true)}
      >
        How to change
      </button>
      {open && <ChangeUrlDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The URL is read once at start (sign-in checks and email links use it), so it changes on the
 * server, not here: one command updates it with the certificate and restarts the app.
 */
function ChangeUrlDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Change the URL"
      description="The address is set on the server, so an admin with access to it makes the change."
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <ol className="m-0 flex list-decimal flex-col gap-3 pl-5 text-13 text-tx2">
        <li>Point the new name's DNS A record at this server.</li>
        <li>
          On the server, run:
          <pre className="m-0 mt-1.5 overflow-x-auto rounded-control border border-br3 bg-sf2 px-3 py-2.5 font-mono text-12h text-tx3">
            {COMMAND}
          </pre>
          It checks the name, updates the URL and the certificate, restarts Bemmoly and puts the old
          address back if it does not come up.
        </li>
      </ol>
      <ul className="m-0 mt-4 flex list-disc flex-col gap-1 pl-5 text-12 text-tx4">
        <li>Bemmoly is unavailable for a few seconds while it restarts.</li>
        <li>With a new name, everyone signs in again at the new address.</li>
        <li>Links in emails sent before the change keep the old address.</li>
        <li>On Kubernetes, change publicUrl in your Helm values instead.</li>
      </ul>
    </Modal>
  );
}
