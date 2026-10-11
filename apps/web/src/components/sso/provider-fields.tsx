import { Field, Input, Textarea } from '@bemmoly/ui';
import type { SsoProviderForm } from '../../hooks/use-sso-provider-form.ts';
import type { SsoPreset } from '../../lib/sso-presets.ts';

interface ProviderFieldsProps {
  preset: SsoPreset;
  form: SsoProviderForm;
  /** Editing a saved provider: secrets are stored and stay unless replaced. */
  editing: boolean;
  disabled?: boolean;
}

/** What the identity provider gave the admin: issuer and client (OIDC), or metadata (SAML). */
export function ProviderFields({ preset, form, editing, disabled }: ProviderFieldsProps) {
  const { draft, set, errors } = form;
  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Name on the sign-in page" error={errors['displayName']}>
        <Input
          value={draft.displayName}
          disabled={disabled}
          onChange={(event) => set('displayName')(event.target.value)}
        />
      </Field>
      {preset.protocol === 'oidc' ? (
        <>
          <Field
            label="Issuer URL"
            hint="Its /.well-known/openid-configuration is read for everything else."
            error={errors['config.issuerUrl']}
          >
            <Input
              value={draft.issuerUrl}
              placeholder="https://id.example.com"
              disabled={disabled}
              spellCheck={false}
              onChange={(event) => set('issuerUrl')(event.target.value)}
            />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Client ID" error={errors['config.clientId']}>
              <Input
                value={draft.clientId}
                disabled={disabled}
                spellCheck={false}
                onChange={(event) => set('clientId')(event.target.value)}
              />
            </Field>
            <Field
              label="Client secret"
              hint={editing ? 'Stored encrypted. Leave empty to keep it.' : 'Stored encrypted.'}
              error={errors['config.clientSecret']}
            >
              <Input
                type="password"
                autoComplete="off"
                value={draft.clientSecret}
                disabled={disabled}
                onChange={(event) => set('clientSecret')(event.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Groups claim"
            hint="The claim that lists a person's groups, for the mappings below."
            error={errors['config.groupsClaim']}
          >
            <Input
              value={draft.groupsClaim}
              disabled={disabled}
              spellCheck={false}
              onChange={(event) => set('groupsClaim')(event.target.value)}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Identity provider entity ID" error={errors['config.idpEntityId']}>
            <Input
              value={draft.idpEntityId}
              disabled={disabled}
              spellCheck={false}
              onChange={(event) => set('idpEntityId')(event.target.value)}
            />
          </Field>
          <Field label="Single sign-on URL" error={errors['config.idpSsoUrl']}>
            <Input
              value={draft.idpSsoUrl}
              placeholder="https://id.example.com/saml/sso"
              disabled={disabled}
              spellCheck={false}
              onChange={(event) => set('idpSsoUrl')(event.target.value)}
            />
          </Field>
          <Field
            label="Signing certificate"
            hint={
              editing
                ? 'Every assertion must be signed with it. Leave empty to keep the stored one.'
                : 'Every assertion must be signed with it. Paste the PEM, BEGIN to END.'
            }
            error={errors['config.idpCertificate']}
          >
            <Textarea
              rows={4}
              value={draft.idpCertificate}
              disabled={disabled}
              spellCheck={false}
              className="font-mono text-12"
              placeholder="-----BEGIN CERTIFICATE-----"
              onChange={(event) => set('idpCertificate')(event.target.value)}
            />
          </Field>
        </>
      )}
    </div>
  );
}
