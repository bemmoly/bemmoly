import type { HTMLAttributes, ReactNode } from 'react';

/**
 * PLACEHOLDER for @bemmoly/ui Table. The mocks lay tables out as CSS grids
 * with fixed column templates; `columns` is that template.
 */
export function Table({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="table"
      aria-label={label}
      className="overflow-hidden rounded-card border border-br bg-sf"
    >
      {children}
    </div>
  );
}

export function TableHead({ columns, children }: { columns: string; children: ReactNode }) {
  return (
    <div
      role="row"
      style={{ gridTemplateColumns: columns }}
      className="grid items-end gap-3 border-b border-br2 bg-head-bg px-4 py-2.25 text-mono font-medium tracking-[.06em] text-tx5 uppercase"
    >
      {children}
    </div>
  );
}

export function TableRow({
  columns,
  className,
  children,
  ...rest
}: { columns: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="row"
      style={{ gridTemplateColumns: columns }}
      className={`grid items-center gap-3 border-b border-row-line px-4 py-2.5 last:border-b-0 ${className ?? ''}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Cell({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div role="cell" className={`min-w-0 ${className ?? ''}`}>
      {children}
    </div>
  );
}

export function HeadCell({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div role="columnheader" className={className}>
      {children}
    </div>
  );
}
