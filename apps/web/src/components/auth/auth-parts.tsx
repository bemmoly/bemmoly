import { useT } from '@bemmoly/core-web';
import { Avatar } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { shellText } from '../../i18n/catalogs.ts';

export type NoteTone = 'danger' | 'caution' | 'info' | 'neutral';

const TONES: Record<NoteTone, { box: string; icon: string }> = {
  danger: { box: 'bg-red-50', icon: 'text-red-tx' },
  caution: { box: 'bg-amber-50', icon: 'text-amber-tx' },
  info: { box: 'bg-sunken shadow-[inset_0_0_0_1px_var(--line)]', icon: 'text-acc' },
  neutral: { box: 'bg-sunken shadow-[inset_0_0_0_1px_var(--line)]', icon: 'text-tx-2' },
};

/**
 * One honest sentence about what happened, with what to do next. A failure is an `alert`, so it
 * is read out at once; anything else (signed out, a wait, a sent email) is a polite `status`.
 */
export function AuthNote({
  tone,
  icon,
  title,
  children,
  actions,
}: {
  tone: NoteTone;
  icon: IconName;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const look = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`grid grid-cols-[20px_1fr] gap-2.5 rounded-card px-3.5 py-3 ${look.box}`}
    >
      <span className={`mt-px flex ${look.icon}`}>
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <b className="block text-14 font-semibold">{title}</b>
        {children ? <p className="m-0 mt-0.5 text-13 leading-body text-tx-2">{children}</p> : null}
        {actions ? <div className="mt-2.5 flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}

/** The person this device remembers, with "Not you?" to forget them. */
export function PersonRow({
  name,
  email,
  onForget,
}: {
  name: string | null;
  email: string;
  onForget: () => void;
}) {
  const t = useT(shellText);
  return (
    <div className="flex items-center gap-3 rounded-card bg-card px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
      <Avatar name={name ?? email} size={32} />
      <div className="min-w-0">
        <b className="block truncate text-14 font-semibold">{name ?? email}</b>
        {name ? <span className="block truncate text-13 text-tx-2">{email}</span> : null}
      </div>
      <button
        type="button"
        onClick={onForget}
        className="ms-auto shrink-0 cursor-pointer rounded-chip border-0 bg-transparent p-1 text-13 font-medium text-acc hover:text-acc-600 focus-visible:outline-2 focus-visible:outline-acc"
      >
        {t('shell.signIn.notYou')}
      </button>
    </div>
  );
}

/** The quiet rule between single sign-on and the password form. */
export function OrRule({ children }: { children?: ReactNode }) {
  const t = useT(shellText);
  return (
    <div className="flex items-center gap-3 text-12 text-tx-3">
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      {children ?? t('shell.signIn.or')}
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}

/** A centred line under the form: "Back to sign in", "Admin without single sign-on? …". */
export function AuthAlt({ children }: { children: ReactNode }) {
  return <p className="m-0 text-center text-13 text-tx-2">{children}</p>;
}

/** Small print under a control. */
export function AuthSmall({ children, center }: { children: ReactNode; center?: boolean }) {
  return (
    <p className={`m-0 text-13 leading-body text-tx-3 ${center ? 'text-center' : ''}`}>
      {children}
    </p>
  );
}

/** A link-styled button for in-page actions ("Use a password", "Try Okta again"). */
export function TextButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-chip border-0 bg-transparent p-0 text-13 font-medium text-acc hover:text-acc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc"
    >
      {children}
    </button>
  );
}
