import type { Meta, StoryObj } from '@storybook/react-vite';
import { epicFill, type EpicColor } from '../issue-card/epic-color.ts';
import { DependencyLines } from './dependency-lines.tsx';
import { ForecastChip, type ForecastChipState } from './forecast-chip.tsx';
import { dayOfIso, timelineScale, type TimelineZoom } from './scale.ts';
import { TimelineBar } from './timeline-bar.tsx';
import { TimelineGrid, TimelineHeader } from './timeline-header.tsx';

interface Row {
  name: string;
  key: string;
  tone: EpicColor | 'neutral';
  start: string;
  end: string;
  pct: number;
  state: ForecastChipState;
  daysLate?: number;
  forecast?: [string, string, string];
  milestone?: boolean;
}

/** The Roadmap mock's epics, on its Monday 5 October 2026. */
const ROWS: Row[] = [
  {
    name: 'Auth service',
    key: 'PLT-180',
    tone: 'epic-1',
    start: '2026-09-08',
    end: '2026-10-07',
    pct: 61,
    state: 'on_track',
    forecast: ['2026-10-02', '2026-10-05', '2026-10-07'],
  },
  {
    name: 'Billing v2',
    key: 'PLT-150',
    tone: 'epic-2',
    start: '2026-09-22',
    end: '2026-10-21',
    pct: 34,
    state: 'late',
    daysLate: 11,
    forecast: ['2026-10-27', '2026-11-01', '2026-11-08'],
  },
  {
    name: 'Self-serve onboarding',
    key: 'PLT-160',
    tone: 'epic-4',
    start: '2026-09-01',
    end: '2026-10-10',
    pct: 85,
    state: 'on_track',
  },
  {
    name: 'Observability',
    key: 'PLT-240',
    tone: 'epic-3',
    start: '2026-10-21',
    end: '2026-11-25',
    pct: 0,
    state: 'at_risk',
    forecast: ['2026-11-16', '2026-11-23', '2026-12-04'],
  },
  {
    name: '1.4',
    key: 'Release',
    tone: 'neutral',
    start: '2026-10-12',
    end: '2026-11-02',
    pct: 20,
    state: 'on_track',
    milestone: true,
  },
];

const TODAY = dayOfIso('2026-10-05');
const ROW_HEIGHT = 44;

function Roadmap({ zoom }: { zoom: TimelineZoom }) {
  const scale = timelineScale(zoom, dayOfIso('2026-09-01'), dayOfIso('2026-12-15'));
  const x = (iso: string) => scale.x(dayOfIso(iso));
  const rowOf = (key: string) => ROWS.findIndex((row) => row.key === key);
  return (
    <div className="flex h-110 overflow-auto bg-canvas text-13 text-tx">
      <div className="sticky left-0 z-3 w-75 shrink-0 border-r border-line bg-canvas">
        <div className="sticky top-0 z-2 h-12 border-b border-line bg-canvas" />
        {ROWS.map((row) => (
          <div key={row.key} className="flex h-11 items-center gap-2 border-b border-line-2 px-3">
            <i
              aria-hidden
              className={`size-2.5 shrink-0 rounded-tick ${row.tone === 'neutral' ? 'bg-tx-3' : epicFill(row.tone)}`}
            />
            <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
            <ForecastChip state={row.state} daysLate={row.daysLate ?? null} />
          </div>
        ))}
      </div>
      <div className="relative" style={{ width: scale.width }}>
        <div className="sticky top-0 z-2 border-b border-line">
          <TimelineHeader scale={scale} today={TODAY} />
        </div>
        <div className="relative" style={{ height: ROWS.length * ROW_HEIGHT }}>
          <TimelineGrid scale={scale} today={TODAY} />
          {ROWS.map((row, index) => {
            const left = x(row.start);
            const width = x(row.end) + scale.dayWidth - left;
            const late = row.forecast && row.state === 'late' ? row.forecast[1] : null;
            return (
              <div
                key={row.key}
                className="absolute inset-x-0 h-11 border-b border-line-2"
                style={{ top: index * ROW_HEIGHT }}
              >
                <TimelineBar
                  left={left}
                  width={width}
                  tone={row.tone}
                  label={row.name}
                  progress={row.pct}
                  milestone={row.milestone ?? false}
                  movable
                  late={late ? { width: x(late) - x(row.end), label: 'Forecast Nov 1' } : null}
                  range={
                    row.forecast
                      ? {
                          from: x(row.forecast[0]),
                          likely: x(row.forecast[1]),
                          to: x(row.forecast[2]),
                          warn: row.state !== 'on_track',
                        }
                      : null
                  }
                  aria-label={`${row.name}, ${row.pct}% done`}
                />
              </div>
            );
          })}
          <DependencyLines
            width={scale.width}
            height={ROWS.length * ROW_HEIGHT}
            lines={[
              {
                id: 'billing-observability',
                from: { x: x('2026-10-21') + scale.dayWidth, y: rowOf('PLT-150') * 44 + 22 },
                to: { x: x('2026-10-21'), y: rowOf('PLT-240') * 44 + 22 },
                conflict: true,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/Timeline',
  component: Roadmap,
  args: { zoom: 'months' },
  argTypes: { zoom: { control: 'inline-radio', options: ['weeks', 'months', 'quarters'] } },
  parameters: {
    layout: 'fullscreen',
    mock: [{ file: 'Bemmoly Roadmap.dc.html', x: 240, y: 150, w: 1200, h: 420, note: 'timeline' }],
  },
} satisfies Meta<typeof Roadmap>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The Roadmap mock's quarter, as the roadmap screen draws it: bars, forecast, a dependency. */
export const Months: Story = {};

export const Weeks: Story = { args: { zoom: 'weeks' } };

export const Quarters: Story = { args: { zoom: 'quarters' } };

/** Every state a bar has: moving with its dates, pending, no stored start, no target, child. */
export const BarStates: Story = {
  parameters: { mock: undefined },
  render: () => (
    <div className="flex w-150 flex-col gap-2 bg-canvas p-6 text-13 text-tx">
      {[
        { label: 'Moving', props: { movable: true, dragging: true, hint: 'Sep 29 – Oct 28' } },
        { label: 'Pending', props: { pending: true } },
        { label: 'No stored start', props: { openStart: true } },
        { label: 'No target', props: { ghost: true } },
      ].map(({ label, props }) => (
        <div key={label} className="relative h-11 border-b border-line-2">
          <TimelineBar
            left={80}
            width={260}
            tone="epic-5"
            label={label}
            progress={40}
            aria-label={label}
            {...props}
          />
        </div>
      ))}
      <div className="relative h-8">
        <TimelineBar left={120} width={140} tone="epic-5" size="child" aria-label="Child issue" />
      </div>
      <div className="flex gap-2">
        {(
          ['done', 'on_track', 'at_risk', 'late', 'no_target', 'no_forecast', 'no_work'] as const
        ).map((state) => (
          <ForecastChip key={state} state={state} daysLate={4} />
        ))}
      </div>
    </div>
  ),
};
