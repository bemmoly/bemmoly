import { useDocumentTitle } from '@bemmoly/core-web';
import { EntityTile, Logo } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setupStatusQuery } from '../../hooks/use-session.ts';

/**
 * Sign-in, password reset and invitations (docs/design/premium/brand.js, `signIn`): the
 * customer's workspace leads the card, its logo once uploads exist and its initial until then,
 * and "Powered by Bemmoly" sits under it. Before the workspace has a name the Bemmoly lockup
 * leads instead.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  workspaceName,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Known to the page already (an invitation names its workspace). */
  workspaceName?: string;
}) {
  const status = useQuery(setupStatusQuery);
  const name = workspaceName ?? status.data?.workspaceName ?? null;
  useDocumentTitle([title, name]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sunken px-4 py-12 text-tx">
      <section
        className="flex w-100 max-w-full flex-col gap-4 rounded-dialog bg-card p-6 shadow-e2"
        aria-labelledby="auth-title"
      >
        <div className="flex min-h-7 items-center gap-2.5">
          {name ? (
            <>
              <EntityTile name={name} tone="ink" size={28} />
              <b className="truncate text-16 font-semibold tracking-title">{name}</b>
            </>
          ) : (
            <Logo variant="lockup" size={26} />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h1 id="auth-title" className="m-0 text-16 font-semibold">
            {title}
          </h1>
          {subtitle ? <div className="text-13 leading-body text-tx-2">{subtitle}</div> : null}
        </div>
        {children}
      </section>
      {name ? (
        <p className="m-0 flex items-center gap-1.5 text-12 text-tx-3">
          Powered by <Logo size={13} label="" />
          <b className="font-semibold text-tx-2">Bemmoly</b>
        </p>
      ) : null}
    </div>
  );
}
