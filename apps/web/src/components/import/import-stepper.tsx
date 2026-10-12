import { Icon } from '@bemmoly/ui/icons';
import { Fragment } from 'react';

export const IMPORT_STEPS = ['Connect', 'Choose', 'Options', 'Review', 'Import'] as const;

interface ImportStepperProps {
  /** Where the import is, 0 to 4. */
  current: number;
  /** Steps behind that can be opened again; ahead never can. */
  canVisit: (index: number) => boolean;
  onVisit: (index: number) => void;
}

const SPOKEN = { done: 'done', current: 'current step', ahead: 'not started' } as const;

/**
 * Connect, Choose, Options, Review, Import: where the import is and what follows. A step
 * behind is a button back to it; the current one is marked; ahead are plain. On a phone only
 * the current step keeps its name.
 */
export function ImportStepper({ current, canVisit, onVisit }: ImportStepperProps) {
  return (
    <nav aria-label="Import steps">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
        {IMPORT_STEPS.map((name, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'ahead';
          const body = (
            <>
              <span
                aria-hidden
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-11 font-semibold ${
                  state === 'current'
                    ? 'bg-acc-fill text-on-acc'
                    : state === 'done'
                      ? 'bg-acc-50 text-acc'
                      : 'text-tx-3 shadow-[inset_0_0_0_1.5px_var(--line)]'
                }`}
              >
                {state === 'done' ? <Icon name="check" size={11} /> : index + 1}
              </span>
              <span className={state === 'current' ? '' : 'max-sm:sr-only'}>{name}</span>
              <span className="sr-only">, {SPOKEN[state]}</span>
            </>
          );
          const look = `inline-flex items-center gap-1.75 text-12 ${
            state === 'current'
              ? 'font-semibold text-tx'
              : state === 'done'
                ? 'font-medium text-tx-2'
                : 'font-medium text-tx-3'
          }`;
          return (
            <Fragment key={name}>
              {index > 0 ? <li aria-hidden className="h-px w-6 bg-line max-sm:w-2" /> : null}
              <li aria-current={state === 'current' ? 'step' : undefined}>
                {state === 'done' && canVisit(index) ? (
                  <button
                    type="button"
                    onClick={() => onVisit(index)}
                    className={`${look} -mx-1 cursor-pointer rounded-control border-0 bg-transparent px-1 py-0.5 font-sans hover:bg-hover hover:text-tx focus-ring`}
                  >
                    {body}
                  </button>
                ) : (
                  <span className={look}>{body}</span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
