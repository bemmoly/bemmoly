import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { WorkflowProblem } from '../../../shared/index.ts';

const cx = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(' ');

/** The side panel of the Workflow mock: 340px, white, a br rule on its left. */
export function PanelFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside
      aria-label={label}
      className="flex w-85 shrink-0 flex-col overflow-auto border-l border-line bg-card max-md:max-h-[45vh] max-md:w-full max-md:border-t max-md:border-l-0"
    >
      {children}
    </aside>
  );
}

/** 14px 16px over a br2 rule: the mark, the name in 14px semibold, a chip on the right. */
export function PanelHeader({
  mark,
  title,
  chip,
}: {
  mark?: ReactNode;
  title: ReactNode;
  chip?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-br2 px-4 py-3.5">
      {mark}
      <h2 className="m-0 min-w-0 truncate text-14 font-semibold">{title}</h2>
      {chip && <span className="ml-auto">{chip}</span>}
    </div>
  );
}

/** The panel body: 14px 16px, 16px between sections, 12.5px text. */
export function PanelBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 px-4 py-3.5 text-12h">{children}</div>;
}

/** A section: a semibold heading and its rows 8px apart. */
export function PanelSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 text-12h font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** The mock's "+ Add transition": accent text, medium weight, no box. */
export function AddLink({
  className,
  tone = 'accent',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'accent' | 'danger' }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex cursor-pointer items-center gap-1 self-start border-0 bg-transparent p-0 text-left font-sans text-12h font-medium disabled:cursor-not-allowed disabled:text-tx5',
        tone === 'accent' ? 'text-ac hover:text-ac-d' : 'text-danger hover:text-danger-hi',
        'focus-ring',
        className,
      )}
      {...rest}
    />
  );
}

/** The problems Validate reported for what the panel shows, in danger text. */
export function PanelProblems({ problems }: { problems: readonly WorkflowProblem[] }) {
  if (problems.length === 0) return null;
  return (
    <ul
      aria-label="Problems"
      className="m-0 flex list-none flex-col gap-1.5 rounded-control border border-danger px-2.5 py-2 text-danger"
    >
      {problems.map((problem, index) => (
        <li key={`${problem.code}-${index}`} className="leading-note">
          {problem.message}
        </li>
      ))}
    </ul>
  );
}

/** A quiet note under a section, 12px tx5. */
export function PanelNote({ children }: { children: ReactNode }) {
  return <p className="m-0 text-12 leading-note text-tx5">{children}</p>;
}
