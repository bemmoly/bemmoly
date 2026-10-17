import { memo, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';

export type LogViewSpanKind =
  'plain' | 'dim' | 'bold' | 'error' | 'warning' | 'success' | 'info' | 'accent' | 'link';

export interface LogViewSpan {
  text: string;
  kind: LogViewSpanKind;
  /** For kind "link": where it goes. */
  href?: string;
}

export interface LogViewLine {
  number: number;
  /** The line without escape codes, for copying and search; the spans add up to it. */
  text: string;
  spans: readonly LogViewSpan[];
  /** Drawn on red-50, as the program's error output. */
  error: boolean;
}

export type LogMatchRanges = readonly (readonly [number, number])[];

/** ANSI colours arrive as kinds and are drawn with tokens, never the colour a program asked for. */
const KIND: Record<LogViewSpanKind, string> = {
  plain: '',
  dim: 'text-tx-3',
  bold: 'font-semibold text-tx',
  error: 'text-red-tx',
  warning: 'text-amber-tx',
  success: 'text-green-tx',
  info: 'text-acc',
  accent: 'text-acc',
  link: 'text-acc underline underline-offset-2',
};

/** Placeholder widths, so lines still loading read as text rather than one block. */
const PLACEHOLDER = ['w-40', 'w-72', 'w-56', 'w-96', 'w-32', 'w-64'] as const;

function piece(span: LogViewSpan, text: string, key: string, mark: 'hit' | 'active' | null) {
  const body =
    span.kind === 'link' && span.href ? (
      <a key={key} href={span.href} target="_blank" rel="noreferrer" className={KIND.link}>
        {text}
      </a>
    ) : (
      <span key={key} className={KIND[span.kind] || undefined}>
        {text}
      </span>
    );
  if (!mark) return body;
  return (
    <mark
      key={`${key}m`}
      className={cx(
        'rounded-tick bg-amber-50 text-inherit',
        mark === 'active' && 'ring-1 ring-amber',
      )}
    >
      {body}
    </mark>
  );
}

/**
 * The spans of a line with search hits marked. Hits are character ranges over the whole line,
 * so each span is cut where a hit starts or ends and keeps its own kind on both sides.
 */
export function highlight(
  spans: readonly LogViewSpan[],
  ranges: LogMatchRanges | undefined,
  active: boolean,
): ReactNode[] {
  if (!ranges || ranges.length === 0)
    return spans.map((span, i) => piece(span, span.text, `${i}`, null));
  const out: ReactNode[] = [];
  let offset = 0;
  spans.forEach((span, index) => {
    const start = offset;
    const end = offset + span.text.length;
    offset = end;
    const cuts = new Set([start, end]);
    for (const [from, to] of ranges) {
      if (from > start && from < end) cuts.add(from);
      if (to > start && to < end) cuts.add(to);
    }
    const points = [...cuts].sort((a, b) => a - b);
    for (let i = 0; i < points.length - 1; i += 1) {
      const from = points[i] ?? start;
      const to = points[i + 1] ?? end;
      const hit = ranges.some(([a, b]) => from >= a && to <= b);
      out.push(
        piece(
          span,
          span.text.slice(from - start, to - start),
          `${index}-${from}`,
          hit ? (active ? 'active' : 'hit') : null,
        ),
      );
    }
  });
  return out;
}

export interface LogRowProps {
  number: number;
  line: LogViewLine | undefined;
  selected: boolean;
  ranges: LogMatchRanges | undefined;
  activeMatch: boolean;
  position: number;
  size: number;
  lineLabel: (number: number) => string;
  onSelect?: (number: number) => void;
}

/** One row: the line number (a button that links the line) and the line itself. */
export const LogRow = memo(function LogRow({
  number,
  line,
  selected,
  ranges,
  activeMatch,
  position,
  size,
  lineLabel,
  onSelect,
}: LogRowProps) {
  return (
    <div
      role="listitem"
      aria-posinset={position}
      aria-setsize={size}
      data-line={number}
      className={cx(
        'relative flex h-5 w-full items-center',
        line?.error && 'bg-red-50 text-red-tx',
        selected && !line?.error && 'bg-acc-50',
        selected && 'before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:bg-acc',
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={lineLabel(number)}
        onClick={() => onSelect?.(number)}
        className={cx(
          'h-5 w-14 shrink-0 pe-3 text-end tabular-nums hover:text-tx',
          selected ? 'text-tx' : 'text-tx-3',
        )}
      >
        {number}
      </button>
      {line ? (
        <span className="whitespace-pre pe-4">{highlight(line.spans, ranges, activeMatch)}</span>
      ) : (
        <span
          aria-hidden
          className={cx('h-2 rounded-tick bg-line-2', PLACEHOLDER[number % PLACEHOLDER.length])}
        />
      )}
    </div>
  );
});
