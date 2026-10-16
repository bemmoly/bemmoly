import { useDocumentTitle, useT } from '@bemmoly/core-web';
import { EmptyState } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { useOverview } from '../hooks/use-overview.ts';
import { useScope } from '../hooks/use-scope.ts';
import { pipelinesText } from '../i18n/catalog.ts';

/** The name of the scope in words: the group, the domain, or the organisation. */
export function useScopeName(): string {
  const { path } = useScope();
  const scope = useOverview(path).data?.scope;
  return scope?.group?.name ?? scope?.domain?.name ?? scope?.organisation ?? '';
}

/**
 * A screen's title row and body inside the shell's one scrolling area. `meta` sits beside the
 * title ("212 of 1,140 applications"), `actions` at the row's end; `heading` replaces the
 * plain title when a screen's title carries more (a glyph, a tier).
 */
export function ScreenFrame({
  title,
  heading,
  meta,
  actions,
  children,
  className,
}: {
  title: string;
  heading?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  useDocumentTitle([title, 'Pipelines']);
  return (
    <div
      className={`mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-6 ${className ?? ''}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {heading ?? <h1 className="text-20 leading-title font-semibold text-tx">{title}</h1>}
        {meta ? <span className="text-13 text-tx-3 tabular-nums">{meta}</span> : null}
        {actions ? (
          <div className="ms-auto flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/**
 * A screen whose content is still being built: its title, what it will hold for this scope,
 * and an honest note, drawn as the design system's empty state.
 */
export function PlannedScreen({
  title,
  icon,
  description,
}: {
  title: string;
  icon: IconName;
  description: string;
}) {
  const t = useT(pipelinesText);
  return (
    <ScreenFrame title={title}>
      <div className="rounded-card border border-line bg-card py-16 shadow-e1">
        <EmptyState
          icon={<Icon name={icon} size={18} />}
          title={description}
          description={t('pipelines.screen.comingSoon')}
          headingLevel={2}
        />
      </div>
    </ScreenFrame>
  );
}
