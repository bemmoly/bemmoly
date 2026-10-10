import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';

export interface StartGuideStep {
  title: ReactNode;
  description: ReactNode;
  /** Usually one Button; hidden once the step is done. */
  action?: ReactNode;
  done?: boolean;
}

export interface StartGuideProps {
  title: ReactNode;
  description?: ReactNode;
  /** Two to four steps, in the order to take them. */
  steps: readonly StartGuideStep[];
  /** Art above the title, such as a row of space tiles. */
  art?: ReactNode;
  className?: string;
}

/**
 * A first run: a module with nothing in it yet, shown as the few steps that fill it rather
 * than as a blank list. No mock shows one; it is built from the Docs home's parts: the 8px
 * card on sf with a br border, 15px semibold section titles, 12.5px tx4 copy, and numbered
 * 22px discs in the accent pair that turn into a check once a step is done. The steps sit
 * side by side and stack on a narrow screen.
 */
export function StartGuide({ title, description, steps, art, className }: StartGuideProps) {
  const next = steps.findIndex((step) => !step.done);
  return (
    <section
      aria-label={typeof title === 'string' ? title : undefined}
      className={cx(
        'flex flex-col items-center gap-6 rounded-card border border-br bg-sf px-6 py-10 text-center motion-safe:animate-fade-in sm:px-10',
        className,
      )}
    >
      <div className="flex max-w-120 flex-col items-center gap-2">
        {art && (
          <div aria-hidden className="mb-2">
            {art}
          </div>
        )}
        <h2 className="m-0 text-18 font-semibold tracking-title text-tx">{title}</h2>
        {description && <p className="m-0 text-13h leading-body text-tx4">{description}</p>}
      </div>
      <ol
        className={cx(
          'm-0 grid w-full list-none gap-3 p-0 text-left',
          steps.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2',
        )}
      >
        {steps.map((step, index) => {
          const current = index === next;
          return (
            <li
              key={index}
              aria-current={current ? 'step' : undefined}
              className={cx(
                'flex flex-col gap-2 rounded-card border p-4',
                current ? 'border-ac-br bg-ac-bg2' : 'border-br bg-sf',
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cx(
                    'flex size-5.5 shrink-0 items-center justify-center rounded-full text-11 font-semibold',
                    step.done
                      ? 'bg-ok-bg text-ok-fg'
                      : current
                        ? 'bg-ac-fill text-on-ac'
                        : 'bg-chip text-tx4',
                  )}
                >
                  {step.done ? <Icon name="check" size={12} /> : index + 1}
                </span>
                <span
                  className={cx(
                    'text-13 font-semibold',
                    step.done ? 'text-tx5 line-through' : 'text-tx',
                  )}
                >
                  {step.title}
                </span>
                {step.done && <span className="sr-only">(done)</span>}
              </span>
              <span className="text-12h leading-body text-tx4">{step.description}</span>
              {step.action && !step.done && <span className="mt-auto pt-1">{step.action}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
