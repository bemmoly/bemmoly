import type { ImportField, ImportSource } from '@bemmoly/shared';
import { Button, Field, Input, Select, SettingsSection } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { FormEvent } from 'react';
import { FormError } from '../form.tsx';

export const SECRET_HINT = 'Stored encrypted; never shown again.';

interface ConnectFormProps {
  source: ImportSource;
  fields: readonly ImportField[];
  values: Readonly<Record<string, string>>;
  /** The chosen file's name per file field. */
  files: Readonly<Record<string, string>>;
  fileError: string | null;
  error: unknown;
  busy: boolean;
  canConnect: boolean;
  onChange: (field: ImportField, value: string) => void;
  onFile: (field: ImportField, file: File | null) => void;
  onConnect: () => void;
  onBack: () => void;
}

const FILE_INPUT =
  'w-full text-13 text-tx-2 file:mr-3 file:h-control file:cursor-pointer file:rounded-control file:border file:border-line file:bg-card file:px-3 file:font-sans file:text-13 file:font-medium file:text-tx';

/** Field hands its id and descriptions to its one child; they pass through to the control. */
function Control({ field, value, onChange, onFile, ...a11y }: ControlProps) {
  if (field.kind === 'select') {
    return (
      <Select
        {...a11y}
        name={field.name}
        value={value}
        options={field.options ?? []}
        onChange={(event) => onChange(field, event.value)}
      />
    );
  }
  if (field.kind === 'file') {
    return (
      <input
        {...a11y}
        type="file"
        name={field.name}
        accept=".csv,text/csv"
        className={FILE_INPUT}
        onChange={(event) => onFile(field, event.target.files?.[0] ?? null)}
      />
    );
  }
  const secret = field.kind === 'secret';
  return (
    <Input
      {...a11y}
      name={field.name}
      type={secret ? 'password' : field.kind === 'text' ? 'text' : field.kind}
      autoComplete={secret ? 'new-password' : 'off'}
      mono={field.kind === 'url'}
      required={field.required}
      placeholder={field.placeholder}
      value={value}
      onChange={(event) => onChange(field, event.target.value)}
    />
  );
}

interface ControlProps {
  field: ImportField;
  value: string;
  onChange: (field: ImportField, value: string) => void;
  onFile: (field: ImportField, file: File | null) => void;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

function hintOf(field: ImportField, fileName: string | undefined) {
  if (field.kind === 'secret') return field.help ? `${field.help} ${SECRET_HINT}` : SECRET_HINT;
  if (field.kind === 'file' && fileName) return `${fileName} is ready to send.`;
  return field.help;
}

/** The source's connection form, drawn from its field list; Connect looks at what it holds. */
export function ConnectForm(props: ConnectFormProps) {
  const { source, fields, values, files, fileError, error, busy, canConnect } = props;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canConnect && !busy) props.onConnect();
  };
  return (
    <SettingsSection
      title={`Connect to ${source.label}`}
      hint={`Brings ${source.brings.join(', ').toLowerCase()}`}
    >
      <form
        aria-label={`Connect to ${source.label}`}
        className="flex flex-col gap-4"
        onSubmit={submit}
        noValidate
      >
        {fields.map((field) => (
          <Field
            key={field.name}
            label={field.required ? field.label : `${field.label} (optional)`}
            hint={hintOf(field, files[field.name])}
            error={field.kind === 'file' ? fileError : undefined}
          >
            <Control
              field={field}
              value={values[field.name] ?? ''}
              onChange={props.onChange}
              onFile={props.onFile}
            />
          </Field>
        ))}
        <FormError error={error} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" icon={<Icon name="back" />} onClick={props.onBack}>
            Other sources
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!canConnect}>
            Connect
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
