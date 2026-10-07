import type { BackupSchedule } from '@bemmoly/shared';
import { Field, Input, SettingsSection, Switch } from '@bemmoly/ui';
import type { S3Secrets } from '../../hooks/use-backups-schedule.ts';
import type { FieldErrors } from '../../lib/errors.ts';
import { LINK_ACTION } from '../actions.ts';

type Bucket = NonNullable<BackupSchedule['s3']>;

interface DestinationsCardProps {
  schedule: BackupSchedule;
  update: (patch: Partial<BackupSchedule>) => void;
  setBucket: (on: boolean) => void;
  secrets: S3Secrets;
  stored: Record<keyof S3Secrets, boolean>;
  setSecret: (patch: Partial<S3Secrets>) => void;
  errors: FieldErrors;
}

const BUCKET_FIELDS: Array<{ key: keyof Bucket; label: string; placeholder: string }> = [
  { key: 'endpoint', label: 'Endpoint', placeholder: 'https://s3.eu-central-1.amazonaws.com' },
  { key: 'bucket', label: 'Bucket', placeholder: 'acme-bemmoly-backups' },
  { key: 'region', label: 'Region', placeholder: 'eu-central-1' },
  { key: 'prefix', label: 'Prefix', placeholder: 'bemmoly/' },
];

export function DestinationsCard({
  schedule,
  update,
  setBucket,
  secrets,
  stored,
  setSecret,
  errors,
}: DestinationsCardProps) {
  const s3 = schedule.s3;
  return (
    <SettingsSection title="Destinations">
      <Field label="Local disk" hint="Set by the installer. Every backup is written here first.">
        <Input mono readOnly value={schedule.localPath} />
      </Field>
      <div className="flex items-center gap-3 border-t border-br-row pt-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">Copy to an S3-compatible bucket</span>
          <span className="text-12 text-tx5">
            A second destination off this machine. Copies are encrypted before they leave.
          </span>
        </div>
        <Switch aria-label="Copy to a bucket" checked={s3 !== null} onCheckedChange={setBucket} />
      </div>
      {s3 ? (
        <div className="grid grid-cols-2 gap-3.5">
          {BUCKET_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} error={errors[`s3.${field.key}`]}>
              <Input
                mono
                placeholder={field.placeholder}
                value={s3[field.key]}
                onChange={(event) => update({ s3: { ...s3, [field.key]: event.target.value } })}
              />
            </Field>
          ))}
          <SecretField
            label="Access key id"
            value={secrets.accessKeyId}
            isSet={stored.accessKeyId}
            error={errors['accessKeyId']}
            onChange={(accessKeyId) => setSecret({ accessKeyId })}
          />
          <SecretField
            label="Secret access key"
            value={secrets.secretAccessKey}
            isSet={stored.secretAccessKey}
            error={errors['secretAccessKey']}
            onChange={(secretAccessKey) => setSecret({ secretAccessKey })}
            password
          />
        </div>
      ) : null}
    </SettingsSection>
  );
}

interface SecretFieldProps {
  label: string;
  /** null: not being edited, so the stored value stays. */
  value: string | null;
  isSet: boolean;
  error: string | undefined;
  onChange: (value: string | null) => void;
  password?: boolean;
}

/** Write-only: a stored secret shows only as "Set" until the admin chooses to replace it. */
function SecretField({ label, value, isSet, error, onChange, password }: SecretFieldProps) {
  if (isSet && value === null) {
    return (
      <Field label={label} hint="Stored encrypted; it is never shown again.">
        <Input
          readOnly
          value="Set"
          suffix={
            <button
              type="button"
              className={`text-12h ${LINK_ACTION}`}
              onClick={() => onChange('')}
            >
              Replace
            </button>
          }
        />
      </Field>
    );
  }
  return (
    <Field
      label={label}
      error={error}
      hint={isSet ? 'Leave blank to keep the stored value.' : 'Stored encrypted; write-only.'}
    >
      <Input
        mono
        type={password ? 'password' : 'text'}
        autoComplete="off"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
