import type { ReactNode } from 'react';

/** A titled group of cards on a settings page, for lists that sit outside a card's header. */
export function PageBlock({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="m-0 text-15 font-semibold tracking-title">
        {title}
      </h2>
      {children}
    </section>
  );
}
