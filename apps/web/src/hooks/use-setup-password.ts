import { useState } from 'react';

/** The password schema's floor; anything shorter is refused, whatever it contains. */
export const MIN_PASSWORD = 12;

export interface PasswordStrength {
  /** 0 empty or too short, 1 weak, 2 fair, 3 good, 4 strong: the meter's filled bars. */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/**
 * A quick, honest estimate: length counts most, then variety, and a run of one character or
 * a common pattern pulls it down. It guides; the server's rule (at least 12) decides.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < MIN_PASSWORD) return { score: 0, label: password ? LABELS[0] : '' };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const unique = new Set(password.toLowerCase()).size;
  let points = 1;
  if (password.length >= 16) points += 1;
  if (password.length >= 20) points += 1;
  if (kinds >= 3) points += 1;
  if (/\s/.test(password.trim()) && password.length >= 16) points += 1;
  if (unique < 5 || /(password|qwerty|123456|letmein|bemmoly)/i.test(password)) points = 1;
  const score = Math.min(points, 4) as PasswordStrength['score'];
  return { score, label: LABELS[score] };
}

/** The show/hide toggle: hidden by default, and hidden again after the form is sent. */
export function usePasswordVisibility() {
  const [shown, setShown] = useState(false);
  return {
    shown,
    type: shown ? 'text' : 'password',
    toggle: () => setShown((value) => !value),
    toggleLabel: shown ? 'Hide' : 'Show',
    hide: () => setShown(false),
  };
}
