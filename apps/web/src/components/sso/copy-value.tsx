import { Field, IconButton, Input } from '@bemmoly/ui';
import type { SsoServiceProvider } from '@bemmoly/shared';
import { toast } from '../../lib/toast.ts';

/**
 * Copies a value. The clipboard API exists only on secure origins, and a self-hosted install is
 * often plain http on a LAN, so the value is also on screen, selectable, to copy by hand.
 */
async function copy(value: string, what: string) {
  try {
    if (!navigator.clipboard) throw new Error('The clipboard is not available here');
    await navigator.clipboard.writeText(value);
    toast(`${what} copied`);
  } catch {
    toast('Copying is blocked on this connection. Select the value and copy it.', 'danger');
  }
}

/** A read-only value with a copy button: callback URLs, entity IDs, a token shown once. */
export function CopyValue({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-end gap-2">
      <Field label={label} className="min-w-0 flex-1" {...(hint ? { hint } : {})}>
        <Input
          readOnly
          value={value}
          className="font-mono text-12"
          onFocus={(event) => event.currentTarget.select()}
        />
      </Field>
      <span className={hint ? 'mb-5.5' : ''}>
        <IconButton
          icon="copy"
          label={`Copy ${label.toLowerCase()}`}
          onClick={() => void copy(value, label)}
        />
      </span>
    </div>
  );
}

/** What to paste into the identity provider's app settings for this provider. */
export function ServiceProviderValues({
  protocol,
  values,
}: {
  protocol: 'oidc' | 'saml';
  values: SsoServiceProvider;
}) {
  return (
    <div className="flex flex-col gap-3">
      <CopyValue
        label={protocol === 'oidc' ? 'Redirect URI' : 'Assertion consumer service URL'}
        value={values.callbackUrl}
      />
      {protocol === 'saml' ? (
        <>
          <CopyValue label="Entity ID (audience)" value={values.entityId} />
          {values.metadataUrl ? (
            <CopyValue
              label="Metadata URL"
              value={values.metadataUrl}
              hint="Or give the identity provider this address to read everything above."
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
