import { Input } from '@bemmoly/ui';
import { useId } from 'react';
import { passwordStrength, usePasswordVisibility } from '../../hooks/use-setup-password.ts';

const BAR_TONE = ['bg-line', 'bg-red', 'bg-amber', 'bg-green', 'bg-green'] as const;

interface PasswordFieldProps {
  value: string;
  error?: string | undefined;
  hint: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

/**
 * A new password: a Show/Hide toggle inside the field, and under it a four-bar meter with a
 * word. The meter guides; the field's message (at least 12 characters) is the rule.
 */
export function PasswordField({ value, error, hint, onChange, onBlur }: PasswordFieldProps) {
  const id = useId();
  const visibility = usePasswordVisibility();
  const strength = passwordStrength(value);
  const messageId = `${id}-message`;
  const meterId = `${id}-meter`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium text-tx">
        Password
      </label>
      <Input
        id={id}
        size="lg"
        type={visibility.type}
        autoComplete="new-password"
        spellCheck={false}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${messageId} ${meterId}`}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        suffix={
          <button
            type="button"
            onClick={visibility.toggle}
            aria-pressed={visibility.shown}
            aria-label={visibility.shown ? 'Hide password' : 'Show password'}
            className="-mr-1.5 shrink-0 cursor-pointer rounded-chip border-0 bg-transparent px-1.5 py-1 font-sans text-12 font-medium text-tx-2 hover:bg-hover hover:text-tx focus-ring"
          >
            {visibility.toggleLabel}
          </button>
        }
      />
      <div id={meterId} className="flex items-center gap-2.5" aria-live="polite">
        <span aria-hidden="true" className="flex flex-1 gap-1">
          {[1, 2, 3, 4].map((bar) => (
            <span
              key={bar}
              className={`h-1 flex-1 rounded-full motion-safe:transition-colors ${
                strength.score >= bar ? BAR_TONE[strength.score] : 'bg-line'
              }`}
            />
          ))}
        </span>
        <span className="w-16 text-right text-12 text-tx-3">
          {strength.label ? (
            <>
              <span className="sr-only">Password strength: </span>
              {strength.label}
            </>
          ) : null}
        </span>
      </div>
      <span id={messageId} className={`text-12 ${error ? 'text-red-tx' : 'text-tx-3'}`}>
        {error ?? hint}
      </span>
    </div>
  );
}
