import { Field, Input, SegmentedControl, Select, SettingsRow, SettingsSection } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import { PROVIDER_OPTIONS, SECURITY_OPTIONS, type EmailForm } from '../../hooks/use-email-form.ts';
import type { FieldErrors } from '../../lib/errors.ts';
import { Notice } from '../form.tsx';
import { PasswordField } from './password-field.tsx';

interface DeliverySectionProps {
  value: EmailForm;
  errors: FieldErrors;
  disabled: boolean;
  usesDevMailbox: boolean;
  password: { isSet: boolean; editing: boolean; replace: () => void };
  onChange: (patch: Partial<EmailForm>) => void;
}

/** Delivery: the provider, then (for SMTP) the relay's address, security and sign-in. */
export function DeliverySection({
  value,
  errors,
  disabled,
  usesDevMailbox,
  password,
  onChange,
}: DeliverySectionProps) {
  const text = (key: 'host' | 'port' | 'username') => ({
    value: value[key],
    onChange: (event: { target: { value: string } }) => onChange({ [key]: event.target.value }),
  });
  return (
    <>
      <SettingsSection title="Delivery" layout="rows">
        <SettingsRow
          title="Send through"
          description="An SMTP relay delivers to real inboxes. The dev mailbox keeps every message on this server."
          control={
            <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
              <SegmentedControl
                aria-label="Send through"
                className="w-72"
                options={PROVIDER_OPTIONS}
                value={value.provider}
                onChange={(provider) => onChange({ provider })}
              />
            </fieldset>
          }
        />
        {usesDevMailbox ? (
          <div className="pb-2.5">
            <Notice tone="caution">
              Mail goes to the dev mailbox on this server; nobody receives it.{' '}
              <Link to="/dev/mailbox" className="font-medium text-ac">
                Open the dev mailbox
              </Link>
            </Notice>
          </div>
        ) : null}
      </SettingsSection>
      {value.provider === 'smtp' ? (
        <SettingsSection title="SMTP relay">
          <fieldset
            disabled={disabled}
            className="m-0 grid min-w-0 grid-cols-[minmax(0,1fr)_120px] gap-3.5 border-0 p-0"
          >
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
          </fieldset>
        </SettingsSection>
      ) : null}
    </>
  );
}
