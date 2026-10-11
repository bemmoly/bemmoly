import type { CodeHostKind } from '@bemmoly/shared';
import { Button, Field, Input, SegmentedControl, Textarea } from '@bemmoly/ui';
import { newWebhookSecret, type CodeHostForm } from '../../hooks/use-code-host-form.ts';

interface HostFieldsProps {
  kind: CodeHostKind;
  form: CodeHostForm;
  disabled?: boolean;
  /** An app Bemmoly created keeps its server and secret; only its name changes here. */
  nameOnly?: boolean;
}

const kept = (editing: boolean) =>
  editing ? 'Stored encrypted. Leave empty to keep it.' : 'Stored encrypted.';

/** Where the host runs and the webhook secret it signs deliveries with. */
export function ServerFields({ kind, form, disabled, nameOnly }: HostFieldsProps) {
  const { draft, set, errors, editing } = form;
  const product = kind === 'github' ? 'GitHub' : 'GitLab';
  const name = (
    <Field label="Name" error={errors['name']}>
      <Input
        value={draft.name}
        disabled={disabled}
        onChange={(event) => set('name')(event.target.value)}
      />
    </Field>
  );
  if (nameOnly) return name;
  return (
    <div className="flex flex-col gap-3.5">
      {name}
      <SegmentedControl
        aria-label="Where it runs"
        value={draft.server}
        onChange={set('server')}
        options={[
          { value: 'cloud', label: kind === 'github' ? 'github.com' : 'gitlab.com' },
          { value: 'self', label: kind === 'github' ? 'Enterprise Server' : 'Self-managed' },
        ]}
      />
      {draft.server === 'self' && (
        <Field
          label={`${product} address`}
          hint="The address people open it at; the API is found from it."
          error={errors['baseUrl']}
        >
          <Input
            value={draft.baseUrl}
            placeholder={kind === 'github' ? 'https://github.acme.dev' : 'https://gitlab.acme.dev'}
            spellCheck={false}
            disabled={disabled}
            onChange={(event) => set('baseUrl')(event.target.value)}
          />
        </Field>
      )}
      <div className="flex items-end gap-2">
        <Field
          className="min-w-0 flex-1"
          label={kind === 'github' ? 'Webhook secret' : 'Secret token'}
          hint={`${kept(editing)} Paste the same value into the ${product} webhook.`}
          error={errors['webhookSecret']}
        >
          <Input
            value={draft.webhookSecret}
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-12"
            disabled={disabled}
            onChange={(event) => set('webhookSecret')(event.target.value)}
          />
        </Field>
        <span className="mb-5.5">
          <Button disabled={disabled} onClick={() => set('webhookSecret')(newWebhookSecret())}>
            Generate
          </Button>
        </span>
      </div>
    </div>
  );
}

/** How Bemmoly calls the API (backfill, the test): a GitHub App or a token. */
export function CredentialFields({ kind, form, disabled }: HostFieldsProps) {
  const { draft, set, errors, editing } = form;
  return (
    <div className="flex flex-col gap-3.5">
      {kind === 'github' && (
        <SegmentedControl
          aria-label="Connect with"
          value={draft.mode}
          onChange={set('mode')}
          options={[
            { value: 'app', label: 'GitHub App' },
            { value: 'token', label: 'Access token' },
          ]}
        />
      )}
      {draft.mode === 'app' ? (
        <>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="App ID" error={errors['credentials.appId']}>
              <Input
                value={draft.appId}
                inputMode="numeric"
                disabled={disabled}
                onChange={(event) => set('appId')(event.target.value)}
              />
            </Field>
            <Field label="Installation ID" error={errors['credentials.installationId']}>
              <Input
                value={draft.installationId}
                inputMode="numeric"
                disabled={disabled}
                onChange={(event) => set('installationId')(event.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Private key"
            hint={`${kept(editing)} The .pem file the app's settings generate.`}
            error={errors['credentials.privateKey'] ?? errors['credentials']}
          >
            <Textarea
              rows={4}
              value={draft.privateKey}
              spellCheck={false}
              className="font-mono text-12"
              placeholder="-----BEGIN RSA PRIVATE KEY-----"
              disabled={disabled}
              onChange={(event) => set('privateKey')(event.target.value)}
            />
          </Field>
        </>
      ) : (
        <Field
          label={kind === 'github' ? 'Access token' : 'Project or group access token'}
          hint={`${kept(editing)} Read access to pull ${kind === 'github' ? 'requests' : 'and merge requests'} is enough.`}
          error={errors['credentials.token'] ?? errors['credentials']}
        >
          <Input
            type="password"
            value={draft.token}
            autoComplete="off"
            disabled={disabled}
            onChange={(event) => set('token')(event.target.value)}
          />
        </Field>
      )}
      <Field
        label="Repositories to backfill"
        hint={`One per line, as ${kind === 'github' ? 'owner/repository' : 'group/project'}. Backfill reads their last 30 days.`}
        error={errors['repositories']}
      >
        <Textarea
          rows={3}
          value={draft.repositories}
          spellCheck={false}
          className="font-mono text-12"
          placeholder={kind === 'github' ? 'acme/api' : 'acme/platform/web'}
          disabled={disabled}
          onChange={(event) => set('repositories')(event.target.value)}
        />
      </Field>
    </div>
  );
}
