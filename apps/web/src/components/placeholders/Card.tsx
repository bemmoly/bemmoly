import type { HTMLAttributes, ReactNode } from 'react';

/** PLACEHOLDER for @bemmoly/ui Card: white panel, 1px border, 8px radius. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`overflow-hidden rounded-card border border-br bg-sf ${className ?? ''}`}
      {...rest}
    />
  );
}

/** "Theme", "Policy", "Inbox": 12px 16px with a hairline under it. */
export function CardHeader({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-br2 px-4 py-3 font-semibold text-tx">
      {children}
      {aside ? <div className="ml-auto flex items-center gap-2 font-normal">{aside}</div> : null}
    </div>
  );
}

/** Settings rows: a label with a hint on the left, a control on the right. */
export function CardRow({
  label,
  hint,
  control,
  last,
}: {
  label: ReactNode;
  hint?: ReactNode;
  control: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 py-2.5 ${last ? '' : 'border-b border-row-line'}`}>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="font-medium text-tx">{label}</span>
        {hint ? <span className="text-caption text-tx5">{hint}</span> : null}
      </div>
      {control}
    </div>
  );
}

export function CardRows({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-card border border-br bg-sf px-4 py-1.5">{children}</div>
  );
}
