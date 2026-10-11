import type { ReactNode } from 'react';

/** The mock's page column: 720px with 48px 40px padding, so the text runs 640px wide. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="w-180 bg-card px-10 py-12">{children}</div>;
}
