import { HeaderActions } from '@bemmoly/core-web';
import { PageTitle } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { Loading } from '../form.tsx';
import { PageFailure } from '../page-failure.tsx';

interface SettingsPageProps {
  title: string;
  description?: ReactNode;
  /** The page's actions ("New team"): shown on the right of the frame's header. */
  actions?: ReactNode;
  /** Kept for callers from before the frame; the header's trail now always shows. */
  breadcrumb?: boolean;
  loading?: boolean;
  error?: unknown;
  children?: ReactNode;
}

/** A settings page in the frame's reading column: its title, then the page's blocks. */
export function SettingsPage({
  title,
  description,
  actions,
  loading,
  error,
  children,
}: SettingsPageProps) {
  return (
    <div className="flex flex-col gap-7">
      {actions ? <HeaderActions>{actions}</HeaderActions> : null}
      <PageTitle variant="settings" title={title} description={description} />
      {error ? <PageFailure error={error} /> : loading ? <Loading lines={5} /> : children}
    </div>
  );
}
