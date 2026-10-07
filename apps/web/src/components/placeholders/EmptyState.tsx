import type { ReactNode } from 'react';

/** PLACEHOLDER for @bemmoly/ui EmptyState. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="font-semibold text-tx">{title}</div>
      {body ? <div className="max-w-105 text-small leading-normal text-tx4">{body}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
