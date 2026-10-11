import { Badge, Field, Input } from '@bemmoly/ui';
import { LINK_ACTION } from '../actions.ts';

interface PasswordFieldProps {
  isSet: boolean;
  editing: boolean;
  value: string;
  error: string | undefined;
  onReplace: () => void;
  onChange: (value: string) => void;
}

/**
 * The SMTP password is write-only: the page only knows whether one is stored.
 * "Replace" opens an empty field; leaving it blank keeps the stored password.
 */
export function PasswordField({
  isSet,
  editing,
  value,
  error,
  onReplace,
  onChange,
}: PasswordFieldProps) {
  if (!editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="font-medium text-tx">Password</span>
        <div className="flex h-9 items-center gap-3">
          <Badge tone="ok">Set</Badge>
          <span className="text-12 text-tx-3">Stored encrypted; it is never shown again.</span>
          <button type="button" className={`ml-auto ${LINK_ACTION}`} onClick={onReplace}>
            Replace
          </button>
        </div>
      </div>
    );
  }
  return (
    <Field
      label={
        <span className="flex items-center gap-2">
          Password
          <Badge tone={isSet ? 'ok' : 'neutral'}>{isSet ? 'Set' : 'Not set'}</Badge>
        </span>
      }
      hint={isSet ? 'Type a new password to replace it, or leave it blank to keep it.' : undefined}
      error={error}
    >
      <Input
        size="lg"
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
