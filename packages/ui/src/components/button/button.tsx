import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

/** From the Board mock: "Create" (primary) and "Complete sprint" (secondary). */
const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-control font-sans text-base font-medium ' +
  'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-0 bg-ac px-3.5 py-1.5 text-on-ac',
  secondary: 'h-control border border-br3 bg-sf px-3 text-tx',
};

export function buttonClassName(variant: ButtonVariant, extra?: string): string {
  return [BASE, VARIANTS[variant], extra].filter(Boolean).join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button type={type} className={buttonClassName(variant, className)} {...rest} />;
}
