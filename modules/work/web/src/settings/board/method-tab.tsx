import { WORKING_DAYS, type EstimationUnit, type WorkMethod } from '@bemmoly/module-work/shared';
import { Card, SegmentedControl, SelectableCard } from '@bemmoly/ui';
import { NO_BOARD_PERMISSION } from '../../hooks/settings-access.ts';
import { cx } from '../cx.ts';
import { EditFooter, SectionHeading } from '../section.tsx';
import { footerProps, type BoardTabProps } from './tab-props.ts';

const METHODS: [WorkMethod, string, string][] = [
  [
    'scrum',
    'Scrum',
    'Sprints, backlog, velocity and burndown. Best when the team plans in fixed cycles.',
  ],
  [
    'kanban',
    'Kanban',
    'Continuous flow, WIP limits, cycle time. Best for support, ops and steady-stream work.',
  ],
];

const ESTIMATES: [EstimationUnit, string, string, string][] = [
  ['points', 'Story points', '5', 'Relative sizing. Fibonacci by default.'],
  ['hours', 'Hours', '6h', 'Time-based. Enables work logging.'],
  ['tshirt', 'T-shirt', 'M', 'XS to XL. Quick, low-ceremony.'],
  ['none', 'No estimation', '–', 'Count issues only.'],
];

const LENGTHS = [7, 14, 21, 28];
const DAY_LETTERS: Record<(typeof WORKING_DAYS)[number], string> = {
  mon: 'M',
  tue: 'T',
  wed: 'W',
  thu: 'T',
  fri: 'F',
  sat: 'S',
  sun: 'S',
};
const DAY_NAMES: Record<(typeof WORKING_DAYS)[number], string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** The Method and estimation tab: Scrum or Kanban, sprint cadence and working days, the unit. */
export function MethodTab(props: BoardTabProps) {
  const { settings, mode, access } = props;
  const value = settings.value;
  if (!value) return null;
  const { config, method } = value;
  const editing = mode === 'edit';
  const boardEditable = editing && access.configureBoard;
  const methodEditable = editing && access.configureProject;
  const set = (patch: Partial<typeof config>) =>
    settings.updateConfig((current) => ({ ...current, ...patch }));
  const lengths = LENGTHS.includes(config.cadenceDays) ? LENGTHS : [...LENGTHS, config.cadenceDays];

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Method"
        description="Scrum runs in time-boxed sprints with a backlog and velocity. Kanban is continuous flow with WIP limits and cycle time. You can switch later; history is kept."
        mode={mode}
        locked={access.configureBoard || access.configureProject ? undefined : NO_BOARD_PERMISSION}
        onEdit={props.onEdit}
      />
      <div role="radiogroup" aria-label="Method" className="grid grid-cols-2 gap-2.5">
        {METHODS.map(([id, name, description]) => (
          <SelectableCard
            key={id}
            selected={method === id}
            aria-disabled={!methodEditable}
            onClick={
              methodEditable ? () => settings.update((d) => ({ ...d, method: id })) : undefined
            }
            className={cx('flex-row gap-3 px-4 py-3.5', !methodEditable && 'cursor-default')}
          >
            <span
              aria-hidden
              className={cx(
                'mt-px size-4 shrink-0 rounded-full border-[1.5px]',
                method === id ? 'border-acc-fill shadow-radio' : 'border-tx-3',
              )}
            />
            <span className="flex flex-col gap-0.75">
              <span className="font-semibold">{name}</span>
              <span className="text-13 leading-note text-tx-3">{description}</span>
            </span>
          </SelectableCard>
        ))}
      </div>
      {method === 'scrum' && (
        <Card className="overflow-hidden">
          <div className="border-b border-line-2 px-4 py-3 font-semibold">Sprints</div>
          <div className="grid grid-cols-2 gap-3.5 px-4 py-3.5">
            <div className="flex flex-col gap-1.5">
              <span id="sprint-length" className="font-medium">
                Length
              </span>
              <SegmentedControl
                aria-labelledby="sprint-length"
                value={String(config.cadenceDays)}
                options={lengths.map((days) => ({
                  value: String(days),
                  label: days % 7 === 0 ? `${days / 7} wk` : `${days} d`,
                }))}
                onChange={(days) => boardEditable && set({ cadenceDays: Number(days) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">Working days</span>
              <div role="group" aria-label="Working days" className="flex gap-1">
                {WORKING_DAYS.map((day) => {
                  const on = config.workingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      aria-label={DAY_NAMES[day]}
                      aria-disabled={!boardEditable}
                      onClick={
                        boardEditable
                          ? () =>
                              set({
                                workingDays: on
                                  ? config.workingDays.filter((d) => d !== day)
                                  : WORKING_DAYS.filter(
                                      (d) => d === day || config.workingDays.includes(d),
                                    ),
                              })
                          : undefined
                      }
                      className={cx(
                        'flex-1 rounded-chip border-0 py-1.5 text-center font-sans text-12 font-semibold',
                        on ? 'bg-acc-50 text-acc' : 'bg-line-2 text-tx-3',
                        boardEditable ? 'cursor-pointer' : 'cursor-default',
                      )}
                    >
                      {DAY_LETTERS[day]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-16 font-semibold">Estimation</h3>
        <p className="m-0 leading-body text-tx-3">
          What shows in the card badge and what velocity and burndown are measured in.
        </p>
      </div>
      <div role="radiogroup" aria-label="Estimation" className="grid grid-cols-4 gap-2.5">
        {ESTIMATES.map(([id, name, sample, description]) => (
          <SelectableCard
            key={id}
            selected={config.estimationUnit === id}
            aria-disabled={!boardEditable}
            onClick={boardEditable ? () => set({ estimationUnit: id }) : undefined}
            className={cx('gap-1.5 px-3.5 py-3', !boardEditable && 'cursor-default')}
          >
            <span className="self-start rounded-full bg-line-2 px-2 py-0.5 font-mono text-14 font-medium text-tx-2">
              {sample}
            </span>
            <span className="font-semibold">{name}</span>
            <span className="text-12 leading-note text-tx-3">{description}</span>
          </SelectableCard>
        ))}
      </div>
      {editing && (
        <EditFooter
          {...footerProps(props, settings.dirty.method)}
          {...(config.workingDays.length === 0
            ? { problems: [...props.problems, 'Pick one working day at least.'] }
            : {})}
        />
      )}
    </div>
  );
}
