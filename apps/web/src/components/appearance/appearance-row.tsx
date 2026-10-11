import { useId, type ReactNode } from 'react';

interface AppearanceRowProps {
  label: string;
  help: ReactNode;
  children: (labelId: string) => ReactNode;
}

/** One row of Settings › Appearance as the review draws it: label and help, then the control. */
export function AppearanceRow({ label, help, children }: AppearanceRowProps) {
  const id = useId();
  return (
    <section className="grid gap-3 border-t border-line py-4.5 md:grid-cols-[200px_minmax(0,1fr)] md:gap-6">
      <div>
        <h2 id={id} className="m-0 text-13 font-semibold text-tx">
          {label}
        </h2>
        <p className="m-0 mt-0.5 text-12 text-tx-3">{help}</p>
      </div>
      <div className="min-w-0">{children(id)}</div>
    </section>
  );
}
