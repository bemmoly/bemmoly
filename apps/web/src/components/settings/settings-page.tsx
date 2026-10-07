import { PageHeader, SettingsContent } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Loading } from '../form.tsx';
import { PageFailure } from '../page-failure.tsx';

interface SettingsPageProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** The Appearance mock shows "Workspace settings / <page>" above the title. */
  breadcrumb?: boolean;
  loading?: boolean;
  error?: unknown;
  children?: ReactNode;
}

/** A settings page inside the frame: the settings header, then the page's blocks. */
export function SettingsPage({
  title,
  description,
  actions,
  breadcrumb,
  loading,
  error,
  children,
}: SettingsPageProps) {
  return (
    <SettingsContent>
      <PageHeader
        variant="settings"
        title={title}
        description={description}
        actions={actions}
        linkAs={Link}
        {...(breadcrumb
          ? { breadcrumbs: [{ label: 'Workspace settings', href: '/settings' }, { label: title }] }
          : {})}
      />
      {error ? <PageFailure error={error} /> : loading ? <Loading lines={5} /> : children}
    </SettingsContent>
  );
}
