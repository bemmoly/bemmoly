import type { ReactNode } from 'react';
import { cx } from '../cx.ts';

/**
 * One property in the row under the title (the kit's .d-prop): 28px tall, 8px sides, 7px
 * radius. Editable ones are buttons that take the hover wash; read-only ones are plain.
 */
export const PROP = cx(
  'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] border-0 bg-transparent px-2 font-sans text-[12.5px] whitespace-nowrap text-tx-2',
  'enabled:cursor-pointer enabled:hover:bg-hover focus-visible:shadow-ring focus-visible:outline-0',
);

/** The quiet key before a value: "Reviewers", "Edited". */
export function PropKey({ children }: { children: ReactNode }) {
  return <span className="text-tx-3">{children}</span>;
}
