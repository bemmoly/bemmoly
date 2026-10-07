import { Field, Input, SettingsSection } from '@bemmoly/ui';
import type { EmailForm } from '../../hooks/use-email-form.ts';
import type { FieldErrors } from '../../lib/errors.ts';

interface SenderSectionProps {
  value: EmailForm;
  errors: FieldErrors;
  disabled: boolean;
  onChange: (patch: Partial<EmailForm>) => void;
}

/** Sender and digests: the from and reply-to addresses, and how often digests go out. */
export function SenderSection({ value, errors, disabled, onChange }: SenderSectionProps) {
  return (
    <SettingsSection title="Sender and digests">
      <fieldset disabled={disabled} className="m-0 grid min-w-0 grid-cols-2 gap-3.5 border-0 p-0">
        <Field
          label="From address"
          hint="The SPF and DMARC checks run against this address's domain."
          error={errors['from']}
        >
          <Input
            size="lg"
            placeholder="Bemmoly <bemmoly@acmelabs.dev>"
            value={value.from}
            onChange={(event) => onChange({ from: event.target.value })}
          />
        </Field>
        <Field
          label="Reply-to"
          hint="Optional. Leave blank to reply to the sender."
          error={errors['replyTo']}
        >
          <Input
            size="lg"
            type="email"
            placeholder="support@acmelabs.dev"
            value={value.replyTo}
            onChange={(event) => onChange({ replyTo: event.target.value })}
          />
        </Field>
        <Field
          label="Digest every"
          hint="Mentions, assignments and review requests always go right away; everything else waits for the digest."
          className="col-span-2"
          error={errors['digestMinutes']}
        >
          <Input
            size="lg"
            inputMode="numeric"
            wrapperClassName="w-40"
            suffix={<span className="text-tx5">minutes</span>}
            value={value.digestMinutes}
            onChange={(event) => onChange({ digestMinutes: event.target.value })}
          />
        </Field>
      </fieldset>
    </SettingsSection>
  );
}
