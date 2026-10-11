import { useId, useState, type KeyboardEvent, type Ref } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { Input, type InputProps } from '../input/input.tsx';
import { passwordStrength, STRENGTH_LABELS } from './strength.ts';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'suffix' | 'autoComplete'> {
  /**
   * What a password manager should do: fill a saved password on sign-in, or offer to save a
   * new one on reset and invitation.
   */
  autoComplete: 'current-password' | 'new-password';
  /** A strength meter under the field, for a new password. */
  meter?: boolean;
  /** The policy's minimum length; under it the meter says "Too short". */
  minLength?: number;
  ref?: Ref<HTMLInputElement>;
}

const METER_TONE = ['bg-red', 'bg-red', 'bg-amber', 'bg-done', 'bg-done'] as const;

/**
 * A password field: a show or hide button (aria-pressed), a Caps Lock hint while the key is on,
 * and an optional strength meter. `name="password"` and the right `autocomplete` are set, so
 * password managers recognise it. Wrap it in `Field`: the label, error and hint attach to the
 * input, and the Caps Lock and meter lines join its description.
 */
export function PasswordInput({
  autoComplete,
  meter = false,
  minLength = 12,
  name = 'password',
  size = 'touch',
  value,
  defaultValue,
  onKeyDown,
  onKeyUp,
  onBlur,
  disabled,
  readOnly,
  ref,
  ...rest
}: PasswordInputProps) {
  const [shown, setShown] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const id = useId();
  const capsId = `${id}-caps`;
  const meterId = `${id}-meter`;
  const text = String(value ?? defaultValue ?? '');
  const score = passwordStrength(text, minLength);
  const readCaps = (event: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(event.getModifierState?.('CapsLock') ?? false);
  const describedBy = [
    rest['aria-describedby'],
    capsLock ? capsId : null,
    meter && text ? meterId : null,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="flex flex-col gap-1.5">
      <Input
        {...rest}
        ref={ref}
        size={size}
        name={name}
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        readOnly={readOnly}
        aria-describedby={describedBy || undefined}
        onKeyDown={(event) => {
          readCaps(event);
          onKeyDown?.(event);
        }}
        onKeyUp={(event) => {
          readCaps(event);
          onKeyUp?.(event);
        }}
        onBlur={(event) => {
          setCapsLock(false);
          onBlur?.(event);
        }}
        suffix={
          <button
            type="button"
            aria-label="Show password"
            aria-pressed={shown}
            aria-controls={rest.id}
            disabled={disabled}
            onClick={() => setShown((current) => !current)}
            className={cx(
              '-mr-1.5 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center',
              'rounded-chip text-tx-3 hover:bg-hover hover:text-tx max-sm:size-9',
              focusRing,
            )}
          >
            <Icon name={shown ? 'eye-off' : 'eye'} />
          </button>
        }
      />
      {capsLock ? (
        <span id={capsId} className="flex items-center gap-1.5 text-12 text-amber-tx">
          <Icon name="caps-lock" size={14} />
          Caps Lock is on
        </span>
      ) : null}
      {meter && text ? (
        <span id={meterId} className="flex items-center gap-2.5 text-12 text-tx-2">
          <span className="flex flex-1 gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((bar) => (
              <span
                key={bar}
                className={cx('h-1 flex-1 rounded-full', bar < score ? METER_TONE[score] : 'bg-line')}
              />
            ))}
          </span>
          <span className="min-w-18 text-right">Strength: {STRENGTH_LABELS[score]}</span>
        </span>
      ) : null}
    </div>
  );
}
