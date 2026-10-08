import { Field, Input, SegmentedControl, Select, SettingsValue, SettingsValues } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import { PROVIDER_OPTIONS, SECURITY_OPTIONS, type EmailForm } from '../../hooks/use-email-form.ts';
import type { FieldErrors } from '../../lib/errors.ts';
import { Notice } from '../form.tsx';
import { PasswordField } from './password-field.tsx';

const labelOf = (options: ReadonlyArray<{ value: string; label: string }>, value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

/** The note under Delivery while mail goes to the dev mailbox. */
export function DevMailboxNotice() {
  return (
    <Notice tone="caution">
      Mail goes to the dev mailbox on this server; nobody receives it.{' '}
      <Link to="/dev/mailbox" className="font-medium text-ac">
        Open the dev mailbox
      </Link>
    </Notice>
  );
}

/** Delivery, read view: where mail goes and, for a relay, how Bemmoly signs in to it. */
export function DeliveryValues({ value, passwordSet }: { value: EmailForm; passwordSet: boolean }) {
  return (
    <SettingsValues>
      <SettingsValue label="Send through">
        {labelOf(PROVIDER_OPTIONS, value.provider)}
      </SettingsValue>
      {value.provider === 'smtp' ? (
        <>
          <SettingsValue label="Server" mono>
            {value.host}:{value.port}
          </SettingsValue>
          <SettingsValue label="Security">
            {labelOf(SECURITY_OPTIONS, value.security)}
          </SettingsValue>
          <SettingsValue label="Username" mono={Boolean(value.username)} muted={!value.username}>
            {value.username || 'None'}
          </SettingsValue>
          <SettingsValue
            label="Password"
            muted={!passwordSet}
            hint={passwordSet ? 'Stored encrypted; it is never shown again.' : undefined}
          >
            {passwordSet ? 'Set' : 'Not set'}
          </SettingsValue>
        </>
      ) : null}
    </SettingsValues>
  );
}

interface DeliveryFieldsProps {
  value: EmailForm;
  errors: FieldErrors;
  password: { isSet: boolean; editing: boolean; replace: () => void };
  onChange: (patch: Partial<EmailForm>) => void;
}

/** Editing Delivery: the provider, then (for SMTP) the relay's address, security and sign-in. */
export function DeliveryFields({ value, errors, password, onChange }: DeliveryFieldsProps) {
  const text = (key: 'host' | 'port' | 'username') => ({
    value: value[key],
    onChange: (event: { target: { value: string } }) => onChange({ [key]: event.target.value }),
  });
  return (
    <>
      <Field
        label="Send through"
        hint="An SMTP relay delivers to real inboxes. The dev mailbox keeps every message on this server."
      >
        <SegmentedControl
          aria-label="Send through"
          className="w-72"
          options={PROVIDER_OPTIONS}
          value={value.provider}
          onChange={(provider) => onChange({ provider })}
        />
      </Field>
      {value.provider === 'smtp' ? (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_120px] gap-3.5">
          <Field label="Server" error={errors['host']}>
            <Input size="lg" mono placeholder="smtp.acmelabs.dev" {...text('host')} />
          </Field>
          <Field label="Port" error={errors['port']}>
            <Input size="lg" mono inputMode="numeric" {...text('port')} />
          </Field>
          <Field label="Security" className="col-span-2" error={errors['security']}>
            <Select
              size="md"
              options={SECURITY_OPTIONS}
              value={value.security}
              onChange={(event) =>
                onChange({ security: event.target.value as EmailForm['security'] })
              }
            />
          </Field>
          <Field label="Username" className="col-span-2" error={errors['username']}>
            <Input size="lg" autoComplete="off" {...text('username')} />
          </Field>
          <div className="col-span-2">
            <PasswordField
              isSet={password.isSet}
              editing={password.editing}
              value={value.password}
              error={errors['password']}
              onReplace={password.replace}
              onChange={(next) => onChange({ password: next })}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
