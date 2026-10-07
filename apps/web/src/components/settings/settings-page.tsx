import type { ReactNode } from 'react';
import { Breadcrumbs, PageHeader, Skeleton } from '../../ui.ts';
import { PageFailure } from '../page-failure.tsx';

interface SettingsPageProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** The Appearance mock shows "Workspace settings / <page>" above the title. */
  breadcrumb?: boolean;
  /** 20px between blocks on People pages, 28px on Appearance. */
  gap?: 'md' | 'lg';
  loading?: boolean;
  error?: unknown;
  children?: ReactNode;
}

/** The content column of a settings page: 1120px max, 28px 40px 60px padding. */
export function SettingsPage({
  title,
  subtitle,
  actions,
  breadcrumb,
  gap = 'md',
  loading,
  error,
  children,
}: SettingsPageProps) {
  return (
    <div className={`flex max-w-280 flex-col px-10 pt-7 pb-15 ${gap === 'md' ? 'gap-5' : 'gap-7'}`}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={actions}
        breadcrumb={breadcrumb ? <Breadcrumbs items={['Workspace settings', title]} /> : undefined}
      />
      {error ? <PageFailure error={error} /> : loading ? <Skeleton rows={5} /> : children}
    </div>
  );
}
