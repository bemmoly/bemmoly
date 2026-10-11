import { Button, Field, Input, SegmentedControl } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { AiCustomProtocol } from '@bemmoly/shared';
import type { FormEvent } from 'react';
import { PROTOCOLS, type Connection } from '../../hooks/use-ai-connection.ts';
import { TestResult } from './test-result.tsx';

function DocLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-chip text-13 text-acc focus-ring"
    >
      Provider documentation
      <Icon name="external" size={14} />
    </a>
  );
}

function LocalFields({ connection }: { connection: Connection }) {
  const { draft, update, errors } = connection;
  const protocol = PROTOCOLS.find((entry) => entry.value === draft.protocol);
  return (
    <>
      <Field label="Name" hint="How this server is listed in Settings and on each role">
        <Input
          size="lg"
          value={draft.name}
          onChange={(event) => update({ name: event.target.value })}
        />
      </Field>
      <Field label="Protocol" hint={protocol?.description}>
        <SegmentedControl<AiCustomProtocol>
          options={PROTOCOLS.map(({ value, label }) => ({ value, label }))}
          value={draft.protocol}
          onChange={(value) => update({ protocol: value })}
        />
      </Field>
      <Field
        label="Base URL"
        hint="The server's address on your network, usually ending in /v1"
        error={errors.baseUrl}
      >
        <Input
          size="lg"
          mono
          inputMode="url"
          autoComplete="off"
          placeholder="http://10.0.0.5:8000/v1"
          value={draft.baseUrl}
          onChange={(event) => update({ baseUrl: event.target.value })}
        />
      </Field>
      <Field label="API key" hint="Optional. Only if your server asks for one.">
        <Input
          size="lg"
          type="password"
          autoComplete="new-password"
          value={draft.apiKey}
          onChange={(event) => update({ apiKey: event.target.value })}
        />
      </Field>
    </>
  );
}

function CatalogFields({ connection }: { connection: Connection }) {
  const { fields, draft, setValue, update, provider } = connection;
  return (
    <>
      {fields.map((field) => (
        <Field
          key={field.name}
          label={<span className="font-mono text-12">{field.name}</span>}
          hint={
            field.secret ? 'Stored encrypted. It can be replaced but never read back.' : undefined
          }
        >
          <Input
            size="lg"
            type={field.secret ? 'password' : 'text'}
            autoComplete={field.secret ? 'new-password' : 'off'}
            mono={!field.secret}
            value={draft.values[field.name] ?? ''}
            onChange={(event) => setValue(field.name, event.target.value)}
          />
        </Field>
      ))}
      <Field
        label="Base URL"
        hint={
          provider.loader === 'compatible'
            ? 'Bemmoly talks to this provider through its compatible API at this address.'
            : 'Filled in from the catalog. Change it only for a proxy or a regional endpoint.'
        }
      >
        <Input
          size="lg"
          mono
          inputMode="url"
          autoComplete="off"
          placeholder="The provider’s default"
          value={draft.baseUrl}
          onChange={(event) => update({ baseUrl: event.target.value })}
        />
      </Field>
    </>
  );
}

/**
 * The connection form for one provider, generated from its catalog entry (one field per name
 * in its env list, the base URL pre-filled), or protocol, address and key for a Local server.
 * Test connection tries the values as typed; nothing is stored until Connect.
 */
export function ConnectionForm({
  connection,
  id,
  inline,
}: {
  connection: Connection;
  /** The form's id, so a dialog's footer button can submit it. */
  id?: string;
  /**
   * Inside another form (the wizard's step): no form element of its own, and a Connect button
   * beside Test, since the step's primary moves on.
   */
  inline?: boolean;
}) {
  const { provider, isLocal, test } = connection;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    connection.connect.run();
  };
  const Wrapper = inline ? 'div' : 'form';
  return (
    <Wrapper
      {...(inline ? {} : { id, noValidate: true, onSubmit: submit })}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {inline ? (
          <h3 className="m-0 text-14 font-semibold text-tx">Connect {provider.name}</h3>
        ) : null}
        {provider.doc ? <DocLink href={provider.doc} /> : null}
      </div>
      {isLocal ? (
        <LocalFields connection={connection} />
      ) : (
        <CatalogFields connection={connection} />
      )}
      {!isLocal && connection.fields.length === 0 ? (
        <p className="m-0 text-13 text-tx-2">
          The catalog lists no keys for this provider. Test the connection to check it answers.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button icon={<Icon name="pulse" />} loading={test.pending} onClick={test.run}>
          Test connection
        </Button>
        {inline ? (
          <Button loading={connection.connect.pending} onClick={connection.connect.run}>
            Connect
          </Button>
        ) : null}
        <span className="text-12 text-tx-3">
          {isLocal ? 'Lists its models and checks tool calling.' : 'Makes one small call.'}
        </span>
      </div>
      <TestResult result={test.result} error={test.error} />
      <TestResult result={null} error={connection.connect.error} />
    </Wrapper>
  );
}
