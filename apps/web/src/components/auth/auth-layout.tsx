import { useDocumentTitle, useT } from '@bemmoly/core-web';
import { Logo } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setupStatusQuery } from '../../hooks/use-session.ts';
import { authText } from '../../i18n/auth.ts';
import { customerLogo } from '../../lib/customer-logo.ts';
import { AuthAside } from './auth-aside.tsx';

/** The workspace as the pages before sign-in know it: its name, its logo and this host. */
export function useAuthWorkspace(override?: string) {
  const status = useQuery(setupStatusQuery);
  const name = override ?? status.data?.workspaceName ?? null;
  const logo = name ? customerLogo(name, status.data?.logoUrl) : null;
  return { name, logo, host: window.location.host, status };
}

interface AuthShellProps {
  /** The tab title; the page's own heading is in `children`. */
  title: string;
  children: ReactNode;
  /** Known to the page already (an invitation names its workspace). */
  workspaceName?: string;
  /** A wider form column (the first-sign-in welcome). */
  wide?: boolean;
}

/**
 * Every page before sign-in (docs/design/system/brand.md, rule 5): a form column and, from
 * 1100px, the product panel in the workspace's theme. Bemmoly appears exactly once. Without a
 * custom logo its lockup leads and the foot shows only the host; with one, the customer's logo
 * and name lead and "Powered by Bemmoly" sits at the foot beside the host.
 */
export function AuthShell({ title, children, workspaceName, wide }: AuthShellProps) {
  const t = useT(authText);
  const { name, logo, host } = useAuthWorkspace(workspaceName);
  // "Sign in to Acme Labs · Bemmoly", not the workspace twice.
  useDocumentTitle(name && !title.includes(name) ? [title, name] : [title]);
  return (
    <div className="grid min-h-dvh bg-canvas text-tx min-[1100px]:grid-cols-[480px_1fr] min-[1300px]:grid-cols-[520px_1fr]">
      <div className="relative z-1 flex min-h-dvh flex-col bg-canvas px-5 pt-5 pb-6 sm:px-10 sm:pt-9 sm:pb-7 min-[1300px]:px-16">
        <header className="flex h-10 items-center gap-3">
          {logo ? (
            <>
              <img
                src={logo.src}
                alt=""
                className="size-9 shrink-0 rounded-control object-contain max-sm:size-8"
              />
              <b className="truncate text-16 font-semibold tracking-brand">{logo.name}</b>
            </>
          ) : (
            <Logo variant="lockup" size={26} label="Bemmoly" />
          )}
        </header>
        <main className="flex flex-1 items-start justify-center pt-10 pb-8 sm:items-center sm:pt-8 min-[1100px]:justify-start">
          <div className={`flex w-full flex-col gap-5 ${wide ? 'max-w-110' : 'max-w-95'}`}>
            {children}
          </div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-12 text-tx-3 max-sm:flex-col-reverse max-sm:items-start">
          {logo ? (
            <span className="inline-flex items-center gap-1.5">
              {t.rich('auth.signIn.poweredBy', undefined, {
                brand: (text) => (
                  <>
                    <Logo size={13} label="" />
                    <b className="font-semibold text-tx-2">{text}</b>
                  </>
                ),
              })}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Icon name="lock" size={12} />
            {host}
          </span>
        </footer>
      </div>
      <AuthAside className="hidden min-[1100px]:grid" />
    </div>
  );
}

/** The page heading: 24px (22px on phones) with an optional lede. */
export function AuthHeading({ title, lede }: { title: ReactNode; lede?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1
        id="auth-title"
        className="m-0 text-24 leading-title font-semibold tracking-display max-sm:text-20"
      >
        {title}
      </h1>
      {lede ? <p className="m-0 text-14 leading-body text-tx-2">{lede}</p> : null}
    </div>
  );
}

/** A simple page in the shell: a heading, an optional lede and the body. */
export function AuthLayout({
  title,
  subtitle,
  children,
  workspaceName,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  workspaceName?: string;
}) {
  return (
    <AuthShell title={title} workspaceName={workspaceName}>
      <AuthHeading title={title} lede={subtitle} />
      {children}
    </AuthShell>
  );
}
