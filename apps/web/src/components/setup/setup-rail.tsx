import type { RailItem, RailState } from '../../hooks/use-setup-wizard.ts';

const DOT: Record<RailState, string> = {
  done: 'border-ok bg-ok text-on-solid',
  current: 'border-ac-fill bg-ac-fill text-on-ac',
  upcoming: 'border-br-ctl bg-sf text-tx4',
};

function RailRow({ item }: { item: RailItem }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={`flex size-5.5 shrink-0 items-center justify-center rounded-full border-[1.5px] text-11 font-semibold ${DOT[item.state]}`}
      >
        {item.marker}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={`font-semibold ${item.state === 'upcoming' ? 'text-tx4' : 'text-tx'}`}>
          {item.name}
        </span>
        <span className="text-12 text-tx5">{item.sub}</span>
      </span>
    </>
  );
}

interface SetupRailProps {
  steps: readonly RailItem[];
  onVisit: (n: number) => void;
  note: string;
}

/** The left column of the wizard: six steps, then the note about changing things later. */
export function SetupRail({ steps, onVisit, note }: SetupRailProps) {
  return (
    <nav aria-label="Setup steps" className="sticky top-6 flex flex-col gap-1">
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {steps.map((item) => {
          const row = `flex w-full items-start gap-3 rounded-panel px-3 py-2.5 text-left font-sans text-13 ${
            item.state === 'current' ? 'bg-sf' : 'bg-transparent'
          }`;
          return (
            <li key={item.n} aria-current={item.state === 'current' ? 'step' : undefined}>
              {item.canVisit ? (
                <button
                  type="button"
                  onClick={() => onVisit(item.n)}
                  className={`${row} cursor-pointer border-0 hover:bg-sf`}
                >
                  <RailRow item={item} />
                </button>
              ) : (
                <div className={row}>
                  <RailRow item={item} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="m-0 mt-5 rounded-card border border-br bg-sf px-3.5 py-3 text-12h leading-brief text-tx3">
        {note}
      </p>
    </nav>
  );
}
