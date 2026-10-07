import type { ReactNode } from 'react';

/** PLACEHOLDER for @bemmoly/ui PageHeader: the 22px settings title row from the People mock. */
export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumb, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-1.5">
      {breadcrumb}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-title font-semibold tracking-[-.015em] text-tx">{title}</h1>
          {subtitle ? <div className="max-w-180 leading-normal text-tx4">{subtitle}</div> : null}
        </div>
        {actions ? <div className="ml-auto flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
