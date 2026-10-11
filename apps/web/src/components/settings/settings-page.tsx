import { HeaderActions } from '@bemmoly/core-web';
import { PageTitle } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { SettingsFailure, SettingsSkeleton } from './settings-states.tsx';

interface SettingsPageProps {
  title: string;
  description?: ReactNode;
  /** The page's actions ("New team"): shown on the right of the frame's header. */
  actions?: ReactNode;
  /** Kept for callers from before the frame; the header's trail now always shows. */
  breadcrumb?: boolean;
  loading?: boolean;
  /** A skeleton shaped like this page's content; two value sections by default. */
  skeleton?: ReactNode;
  error?: unknown;
  /** What Retry does; by default every failed query on the page asks again. */
  onRetry?: () => void;
  children?: ReactNode;
}

/** A settings page in the frame's reading column: its title, then the page's blocks. */
export function SettingsPage({
  title,
  description,
  actions,
  loading,
  skeleton,
  error,
  onRetry,
  children,
}: SettingsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      {actions ? <HeaderActions>{actions}</HeaderActions> : null}
      <PageTitle variant="settings" title={title} description={description} />
      {error ? (
        <SettingsFailure error={error} {...(onRetry ? { onRetry } : {})} />
      ) : loading ? (
        (skeleton ?? <SettingsSkeleton />)
      ) : (
        children
      )}
    </div>
  );
}
