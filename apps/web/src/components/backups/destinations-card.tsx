import { Badge, Button, Checkbox, Field, Input, SettingsSection } from '@bemmoly/ui';
import type { S3Edit, S3Form } from '../../hooks/use-backups-schedule.ts';
import type { FieldErrors } from '../../lib/errors.ts';

interface DestinationsCardProps {
  /** Where the newest backup's local copy sits, when there is one. */
  localPath: string | null;
  configured: boolean;
  s3: S3Edit;
  errors: FieldErrors;
  onStart: () => void;
  onEdit: (form: S3Form) => void;
  onRemove: () => void;
  onKeep: () => void;
}

const TEXT_FIELDS: Array<{
  key: Exclude<keyof S3Form, 'forcePathStyle'>;
  label: string;
  placeholder?: string;
  hint?: string;
  secret?: boolean;
}> = [
  { key: 'bucket', label: 'Bucket', placeholder: 'acme-bemmoly-backups' },
  { key: 'region', label: 'Region', placeholder: 'us-east-1' },
  {
    key: 'endpoint',
    label: 'Endpoint',
    placeholder: 'https://s3.example.com',
    hint: 'Leave blank for AWS S3.',
  },
  { key: 'prefix', label: 'Prefix', placeholder: 'bemmoly/' },
  { key: 'accessKeyId', label: 'Access key id' },
  { key: 'secretAccessKey', label: 'Secret access key', secret: true },
];

export function DestinationsCard({
  localPath,
  configured,
  s3,
  errors,
  onStart,
  onEdit,
  onRemove,
  onKeep,
}: DestinationsCardProps) {
  const state =
    s3.mode === 'remove' ? 'Removed when you save' : configured ? 'Configured' : 'Not configured';
  return (
    <SettingsSection title="Destinations">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">Local disk</span>
          <span className="truncate text-12 text-tx5">
            Every backup is written here first
            {localPath ? (
              <>
                {' '}
                · <span className="font-mono">{localPath}</span>
              </>
            ) : null}
          </span>
        </div>
        <Badge tone="ok">ALWAYS ON</Badge>
      </div>
      <div className="flex items-center gap-3 border-t border-br-row pt-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">S3-compatible bucket</span>
          <span className="text-12 text-tx5">
            A second copy off this machine, always encrypted. Stored as one secret: it is never
            shown again, only replaced.
          </span>
        </div>
        <Badge tone={configured && s3.mode !== 'remove' ? 'ok' : 'neutral'}>
          {state.toUpperCase()}
        </Badge>
        {s3.mode === 'keep' ? (
          <>
            {configured ? (
              <Button size="sm" variant="ghost" onClick={onRemove}>
                Remove
              </Button>
            ) : null}
            <Button size="sm" onClick={onStart}>
              {configured ? 'Replace' : 'Set up'}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={onKeep}>
            {s3.mode === 'remove' ? 'Keep it' : 'Cancel'}
          </Button>
        )}
      </div>
      {s3.mode === 'replace' ? (
        <div className="grid grid-cols-2 gap-3.5">
          {TEXT_FIELDS.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              hint={field.hint}
              error={errors[`s3.${field.key}`]}
            >
              <Input
                mono
                type={field.secret ? 'password' : 'text'}
                autoComplete="off"
                placeholder={field.placeholder}
                value={s3.form[field.key]}
                onChange={(event) => onEdit({ ...s3.form, [field.key]: event.target.value })}
              />
            </Field>
          ))}
          <div className="col-span-2">
            <Checkbox
              label="Use path-style addresses"
              description="MinIO and some other S3-compatible stores need this."
              checked={s3.form.forcePathStyle}
              onChange={(event) => onEdit({ ...s3.form, forcePathStyle: event.target.checked })}
            />
          </div>
        </div>
      ) : null}
    </SettingsSection>
  );
}
