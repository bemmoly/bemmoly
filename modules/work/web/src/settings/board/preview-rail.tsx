import type { BoardDraft } from '../model/sections.ts';
import { cx } from '../cx.ts';
import { ESTIMATE_LABELS, LANE_LABELS, METHOD_LABELS } from '../model/labels.ts';
import { sampleStripe } from './card-preview.tsx';

/** The mock's two sample lanes per grouping, with their colour tokens. */
const LANES: Record<BoardDraft['config']['lanes']['kind'], [string, string][]> = {
  none: [['All issues', 'bg-ac']],
  epic: [
    ['Auth service', 'bg-ac'],
    ['Billing v2', 'bg-violet'],
  ],
  assignee: [
    ['Priya N.', 'bg-ok-fg'],
    ['Aisha K.', 'bg-orange-fg'],
  ],
  priority: [
    ['Highest', 'bg-danger-hi'],
    ['High', 'bg-warn'],
  ],
  type: [
    ['Story', 'bg-ok'],
    ['Bug', 'bg-danger'],
  ],
  query: [
    ['Expedite', 'bg-ac'],
    ['Customer bugs', 'bg-ac'],
  ],
};
const TYPE_DOTS = ['bg-ok', 'bg-danger', 'bg-ac'];
const AVATARS = ['bg-green-bg', 'bg-orange-bg', 'bg-violet-bg', 'bg-ac-av'];

/**
 * The live preview rail: the draft's columns and WIP limits over two sample
 * lanes of sketched cards, as the mock draws them. The cards are a sketch,
 * not data; they follow the card fields and colour of the draft.
 */
export function PreviewRail({ draft, boardHref }: { draft: BoardDraft; boardHref: string }) {
  const { config, method } = draft;
  const n = config.columns.length;
  const grid = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  const on = (field: (typeof config.cardFields)[number]) => config.cardFields.includes(field);
  const stripe = sampleStripe(config.colorRule);
  const lanes =
    config.lanes.kind === 'query' && config.lanes.queries.length > 0
      ? config.lanes.queries.slice(0, 2).map((lane): [string, string] => [lane.name, 'bg-ac'])
      : LANES[config.lanes.kind];
  return (
    <aside
      aria-label="Board preview"
      className="flex min-h-0 w-85 shrink-0 flex-col border-l border-br bg-sf"
    >
      <div className="flex items-center gap-2 border-b border-br2 px-4 py-3 font-semibold">
        Preview
        <span className="text-12 font-normal text-tx5">updates as you edit</span>
        <a href={boardHref} className="ml-auto text-12 font-medium text-ac hover:text-ac-d">
          Open board
        </a>
      </div>
      <div className="flex flex-col gap-3 overflow-auto p-3.5">
        <div
          className="grid gap-1.25 text-9 font-semibold tracking-caps text-tx3 uppercase"
          style={grid}
        >
          {config.columns.map((column) => (
            <div key={column.id} className="truncate px-0.5">
              {column.name} <span className="font-medium text-tx5">{column.wipLimit ?? ''}</span>
            </div>
          ))}
        </div>
        {lanes.map(([name, color], li) => (
          <div key={name} className="overflow-hidden rounded-control border border-br">
            <div className="flex items-center gap-1.5 border-b border-br-row bg-sf2 px-2 py-1.25 text-11 font-semibold">
              <span aria-hidden className={cx('size-1.75 rounded-tick', color)} />
              {name}
            </div>
            <div className="grid gap-1.25 bg-bg2 p-1.5" style={grid}>
              {config.columns.map((column, ci) => {
                const count = ((li + ci) % 3 === 0 ? 2 : 1) - (ci === n - 1 && li ? 1 : 0);
                return (
                  <div key={column.id} className="flex min-h-6.5 flex-col gap-1">
                    {Array.from({ length: count }, (_, k) => (
                      <div
                        key={k}
                        className={cx(
                          'flex flex-col gap-0.75 rounded-xs border border-br bg-sf p-1.25',
                          stripe && cx('border-l-[3px]', stripe),
                        )}
                      >
                        <div
                          className="h-1 rounded-tick bg-br3"
                          style={{ width: `${55 + ((ci * 17 + k * 23 + li * 11) % 40)}%` }}
                        />
                        <div className="flex items-center gap-0.75">
                          {on('type') && (
                            <span
                              className={cx('size-1.5 rounded-hair', TYPE_DOTS[(ci + k) % 3])}
                            />
                          )}
                          {on('key') && <span className="h-1 w-4 rounded-tick bg-trk" />}
                          <span className="ml-auto flex items-center gap-0.75">
                            {on('estimate') && <span className="h-1.75 w-2.5 rounded-xs bg-chip" />}
                            {on('assignee') && (
                              <span
                                className={cx('size-2 rounded-full', AVATARS[(ci + li + k) % 4])}
                              />
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <p className="m-0 pt-1 text-12 leading-body text-tx4">
          {n} columns · lanes by {LANE_LABELS[config.lanes.kind].toLowerCase()} ·{' '}
          {METHOD_LABELS[method]} · {ESTIMATE_LABELS[config.estimationUnit].toLowerCase()}
        </p>
      </div>
    </aside>
  );
}
