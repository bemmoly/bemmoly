import type { RailItem, RailState } from '../../hooks/use-setup-wizard.ts';

/**
 * A step as a circle in the status glyph's language: an empty ring ahead, a ring with a
 * filled centre for where you are, a filled circle with a tick once answered. Skipped steps
 * stay an empty ring (dashed, like a backlog status), so a tick always means "set". The
 * colour is the accent, not the done green, because finishing a step is progress, not success.
 */
export function StepCircle({ state, size = 18 }: { state: RailState; size?: number }) {
  // A skipped ring carries meaning, so it is drawn at the muted text colour, not a hairline.
  const line =
    state === 'upcoming' ? 'var(--line-2)' : state === 'skipped' ? 'var(--tx-3)' : 'var(--acc)';
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 18 18" className="shrink-0">
      {state === 'done' ? (
        <>
          <circle cx="9" cy="9" r="8" fill="var(--acc-fill)" />
          <path
            d="m5.6 9.2 2.3 2.3 4.5-4.8"
            fill="none"
            stroke="var(--on-acc)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <circle
            cx="9"
            cy="9"
            r="7.25"
            fill="var(--card)"
            stroke={line}
            strokeWidth="1.5"
            strokeDasharray={state === 'skipped' ? '2.6 2.2' : undefined}
          />
          {state === 'current' ? <circle cx="9" cy="9" r="3.5" fill="var(--acc)" /> : null}
        </>
      )}
    </svg>
  );
}

const SPOKEN: Record<RailState, string> = {
  done: 'done',
  skipped: 'skipped',
  current: 'current step',
  upcoming: 'not started',
};

function Row({ item }: { item: RailItem }) {
  const current = item.state === 'current';
  return (
    <>
      <StepCircle state={item.state} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={`text-13 ${current ? 'font-semibold text-tx' : 'text-tx-2'}`}>
          {item.name}
          <span className="sr-only">, {SPOKEN[item.state]}</span>
        </span>
        {current ? <span className="text-12 text-tx-3">{item.sub}</span> : null}
      </span>
    </>
  );
}

interface SetupStepperProps {
  steps: readonly RailItem[];
  onVisit: (n: number) => void;
}

/**
 * The left column: a compact vertical stepper, titles only, with the current step's one line
 * under it. A thin line joins the circles. Answered steps can be revisited.
 */
export function SetupStepper({ steps, onVisit }: SetupStepperProps) {
  return (
    <nav aria-label="Setup steps" className="sticky top-24 hidden md:block">
      <ol className="relative m-0 flex list-none flex-col p-0">
        <span
          aria-hidden="true"
          className="absolute top-4 bottom-4 left-[17px] w-px bg-line"
        />
        {steps.map((item) => {
          const row = 'relative flex w-full items-start gap-3 rounded-control px-2 py-2 text-left';
          return (
            <li key={item.n} aria-current={item.state === 'current' ? 'step' : undefined}>
              {item.canVisit ? (
                <button
                  type="button"
                  onClick={() => onVisit(item.n)}
                  className={`${row} cursor-pointer border-0 bg-transparent font-sans hover:bg-hover focus-ring`}
                >
                  <Row item={item} />
                </button>
              ) : (
                <div className={row}>
                  <Row item={item} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** On a phone the stepper becomes one line and a progress bar above the step. */
export function SetupProgress({ steps, counter }: { steps: readonly RailItem[]; counter: string }) {
  const index = steps.findIndex((item) => item.state === 'current');
  const current = steps[index];
  return (
    <div className="flex flex-col gap-2 md:hidden">
      <span className="flex items-center gap-2 text-12 text-tx-3">
        <span className="font-semibold text-tx-2">{current?.name}</span>
        <span aria-hidden="true">·</span>
        {counter}
      </span>
      <span aria-hidden="true" className="flex gap-1">
        {steps.map((item) => (
          <span
            key={item.n}
            className={`h-1 flex-1 rounded-full ${
              item.state === 'done' || item.state === 'current' ? 'bg-acc' : 'bg-line'
            }`}
          />
        ))}
      </span>
    </div>
  );
}
