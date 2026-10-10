import type { BoardLaneKind, BoardLanes } from '@bemmoly/module-work/shared';
import { SelectableCard } from '@bemmoly/ui';
import { NO_BOARD_PERMISSION } from '../../hooks/settings-access.ts';
import { cx } from '../cx.ts';
import { EditFooter, SectionHeading, ToggleCard } from '../section.tsx';
import { NamedQueries } from './named-queries.tsx';
import { footerProps, type BoardTabProps } from './tab-props.ts';

type Bars = [string, string, string];

/** The mock's lane choices with their three-bar sketches: colour token and width per bar. */
const LANES: [BoardLaneKind, string, string, Bars, Bars][] = [
  [
    'none',
    'None',
    'One flat board.',
    ['bg-br3', 'bg-br3', 'bg-br3'],
    ['w-full', 'w-full', 'w-full'],
  ],
  [
    'epic',
    'Epic',
    'Group by parent epic. Shows epic progress per lane.',
    ['bg-epic-1', 'bg-epic-2', 'bg-tx-3'],
    ['w-[70%]', 'w-[55%]', 'w-[40%]'],
  ],
  [
    'assignee',
    'Assignee',
    'One lane per person, unassigned at the bottom.',
    ['bg-ok-fg', 'bg-orange-fg', 'bg-violet-fg'],
    ['w-[60%]', 'w-[60%]', 'w-[60%]'],
  ],
  [
    'priority',
    'Priority',
    'Highest at top so urgent work is seen first.',
    ['bg-danger-hi', 'bg-warn', 'bg-caution'],
    ['w-[30%]', 'w-[55%]', 'w-[85%]'],
  ],
  [
    'type',
    'Issue type',
    'Stories, bugs and tasks in separate lanes.',
    ['bg-ok', 'bg-danger', 'bg-ac'],
    ['w-[65%]', 'w-[45%]', 'w-[70%]'],
  ],
  [
    'query',
    'Custom queries',
    'Define lanes with filter queries, e.g. "Expedite".',
    ['bg-ac', 'bg-ac', 'bg-ac'],
    ['w-[45%]', 'w-[80%]', 'w-[30%]'],
  ],
];

export interface LanesTabProps extends BoardTabProps {
  values: Readonly<Record<string, readonly string[]>>;
}

/** The Swimlanes tab: the default grouping, custom LQL lanes and the lane toggles. */
export function LanesTab(props: LanesTabProps) {
  const { settings, mode, access } = props;
  const lanes = settings.value?.config.lanes;
  if (!lanes) return null;
  const editable = mode === 'edit' && access.configureBoard;
  const set = (patch: Partial<BoardLanes>) =>
    settings.updateConfig((current) => ({ ...current, lanes: { ...current.lanes, ...patch } }));
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Default swimlanes"
        description="What the board is grouped by when someone opens it. Members can change this for themselves from the Group by menu."
        mode={mode}
        locked={access.configureBoard ? undefined : NO_BOARD_PERMISSION}
        onEdit={props.onEdit}
      />
      <div role="radiogroup" aria-label="Default swimlanes" className="grid grid-cols-3 gap-2.5">
        {LANES.map(([kind, name, description, bars, widths]) => (
          <SelectableCard
            key={kind}
            selected={lanes.kind === kind}
            aria-disabled={!editable}
            onClick={editable ? () => set({ kind }) : undefined}
            className={cx('gap-2 px-3.5 py-3', !editable && 'cursor-default')}
          >
            <span aria-hidden className="flex h-8.5 w-full flex-col gap-0.75">
              {bars.map((bar, index) => (
                <span key={index} className={cx('h-1.5 rounded-tick', bar, widths[index])} />
              ))}
            </span>
            <span className="font-semibold">{name}</span>
            <span className="text-12 leading-note text-tx4">{description}</span>
          </SelectableCard>
        ))}
      </div>
      {lanes.kind === 'query' && (
        <NamedQueries
          title="Custom lanes"
          addLabel="+ Add lane"
          noun="lane"
          items={lanes.queries}
          editable={editable}
          catalog={settings.catalog}
          values={props.values}
          onChange={(queries) => set({ queries })}
          footer='Issues matching no lane fall into "Everything else". Queries use the same language as Filters.'
        />
      )}
      <ToggleCard
        readOnly={!editable}
        toggles={[
          {
            title: 'Show empty lanes',
            description: 'Otherwise lanes with no issues are hidden.',
            checked: lanes.showEmpty,
            onChange: (showEmpty) => set({ showEmpty }),
          },
          {
            title: 'Lanes start collapsed when more than 6',
            checked: lanes.collapsible,
            onChange: (collapsible) => set({ collapsible }),
          },
          {
            title: 'Show lane totals and progress',
            description: 'Issue count, points and a progress bar in the lane header.',
            checked: lanes.totals,
            onChange: (totals) => set({ totals }),
          },
        ]}
      />
      {mode === 'edit' && <EditFooter {...footerProps(props, settings.dirty.lanes)} />}
    </div>
  );
}
