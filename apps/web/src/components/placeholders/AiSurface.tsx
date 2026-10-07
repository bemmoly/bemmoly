import type { ReactNode } from 'react';

/**
 * PLACEHOLDER for @bemmoly/ui AiSurface: the accent-tinted block that marks
 * AI-produced content ("Plan · nothing happens until you confirm").
 */
export function AiSurface({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="flex flex-col gap-3 border-b border-br2 bg-ac-bg2 px-4 py-3.5"
      aria-label={label}
    >
      <div className="flex items-center gap-2 text-small font-semibold text-ac">
        <span className="size-1.75 rounded-full bg-ac" aria-hidden="true" />
        {label}
        {hint ? <span className="font-normal text-ac-mute">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}
