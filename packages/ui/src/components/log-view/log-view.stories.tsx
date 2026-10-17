import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useMemo, useState } from 'react';
import type { LogViewLine, LogViewSpan } from './log-line.tsx';
import { LogView, type LogViewProps } from './log-view.tsx';

const plain = (text: string): LogViewSpan => ({ text, kind: 'plain' });

/** The failing shard from the product design, around line 1,184. */
const FAILURE: [string, LogViewSpan[], boolean][] = [
  [
    'PASS',
    [
      { text: 'PASS', kind: 'success' },
      plain('  src/refunds/create.spec.ts (18 tests) '),
      { text: '512ms', kind: 'dim' },
    ],
    false,
  ],
  [
    'PASS',
    [
      { text: 'PASS', kind: 'success' },
      plain('  src/refunds/list.spec.ts (9 tests) '),
      { text: '140ms', kind: 'dim' },
    ],
    false,
  ],
  [
    'FAIL',
    [
      { text: 'FAIL', kind: 'bold' },
      plain('  src/refunds/idempotency.spec.ts (12 tests | 2 failed) 2.1s'),
    ],
    true,
  ],
  ['x', [plain('  x rejects a duplicate idempotency key within 24 hours')], true],
  ['A', [plain('    AssertionError: expected 201 to be 409')], true],
  ['at', [{ text: '      at idempotency.spec.ts:48:31', kind: 'dim' }], false],
  ['x', [plain('  x returns the original refund for a replayed key')], true],
  ['T', [plain('    TimeoutError: lock not acquired within 500ms')], true],
  ['at', [{ text: '      at withAdvisoryLock (src/db/locks.ts:22:11)', kind: 'dim' }], false],
  [
    'W',
    [
      { text: 'warn', kind: 'warning' },
      plain('  slow test: webhooks.spec.ts took 302ms, see '),
      {
        text: 'https://docs.example.com/slow-tests',
        kind: 'link',
        href: 'https://docs.example.com/slow-tests',
      },
    ],
    false,
  ],
  [
    'i',
    [
      { text: 'info', kind: 'info' },
      plain('  retrying with '),
      { text: '--shard=2/3', kind: 'accent' },
    ],
    false,
  ],
];

function makeLine(number: number): LogViewLine {
  const sample = FAILURE[(number - 1) % FAILURE.length];
  const spans = sample?.[1] ?? [plain(`line ${number}`)];
  return { number, spans, text: spans.map((s) => s.text).join(''), error: sample?.[2] ?? false };
}

function Harness({
  total,
  grow,
  delay,
  ...rest
}: Partial<LogViewProps> & { total: number; grow?: boolean; delay?: boolean }) {
  const [count, setCount] = useState(total);
  const [follow, setFollow] = useState(rest.follow ?? false);
  const [selected, setSelected] = useState<number | null>(rest.selectedLine ?? null);
  const [loaded, setLoaded] = useState(() => new Set<number>());
  useEffect(() => {
    if (!grow) return undefined;
    const timer = setInterval(() => setCount((value) => value + 3), 400);
    return () => clearInterval(timer);
  }, [grow]);
  const getLine = useMemo(
    () => (n: number) => (!delay || loaded.has(Math.floor(n / 100)) ? makeLine(n) : undefined),
    [delay, loaded],
  );
  return (
    <div className="h-96 overflow-hidden rounded-card shadow-e1">
      <LogView
        {...rest}
        totalLines={count}
        getLine={getLine}
        onRangeNeeded={(from, to) =>
          setTimeout(
            () =>
              setLoaded((set) => {
                const next = new Set(set);
                for (let n = from; n <= to; n += 100) next.add(Math.floor(n / 100));
                next.add(Math.floor(to / 100));
                return next;
              }),
            400,
          )
        }
        follow={follow}
        onFollowChange={setFollow}
        selectedLine={selected}
        onSelectLine={setSelected}
        ariaLabel="Log of Unit 2 of 3"
        lineLabel={(n) => `Line ${n}`}
      />
    </div>
  );
}

const meta = {
  title: 'Pipelines/LogView',
  component: Harness,
  args: { total: 1212, selectedLine: 1184, scrollTo: { line: 1184, nonce: 1 } },
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Opens on the failure: scrolled to line 1,184, error lines on red-50. */
export const Failure: Story = {};

export const FailureDark: Story = { globals: { mode: 'dark' } };

/** Search hits, the active one ringed. */
export const SearchHits: Story = {
  args: {
    matches: new Map([
      [1180, [[4, 18]]],
      [1183, [[4, 16]]],
    ]),
    activeMatchLine: 1180,
    selectedLine: null,
    scrollTo: { line: 1181, nonce: 2 },
  },
};

/** 100,000 lines, loading by range as they scroll into view. */
export const ManyLines: Story = {
  args: { total: 100_000, delay: true, scrollTo: { line: 50_000, nonce: 3 }, selectedLine: null },
};

/** A running job: lines arrive and the view follows the end until you scroll up. */
export const Following: Story = {
  args: { total: 40, grow: true, follow: true, selectedLine: null, scrollTo: null },
};

export const FollowingDark: Story = { ...Following, globals: { mode: 'dark' } };
