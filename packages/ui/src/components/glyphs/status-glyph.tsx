import { cx } from '../../lib/cx.ts';

/** Where a status sits on the way from backlog to done; the glyph fills as it moves right. */
export type StatusStage = 'backlog' | 'todo' | 'progress' | 'review' | 'qa' | 'done' | 'wont';

/** The server's status categories. */
export type StatusCategoryKey = 'todo' | 'in_progress' | 'done';

const STAGES: Record<StatusStage, { fill: number; tone: 'todo' | 'prog' | 'done'; label: string }> =
  {
    backlog: { fill: 0, tone: 'todo', label: 'Backlog' },
    todo: { fill: 0, tone: 'todo', label: 'To do' },
    progress: { fill: 0.25, tone: 'prog', label: 'In progress' },
    review: { fill: 0.5, tone: 'prog', label: 'In review' },
    qa: { fill: 0.75, tone: 'prog', label: 'QA' },
    done: { fill: 1, tone: 'done', label: 'Done' },
    wont: { fill: -1, tone: 'todo', label: "Won't do" },
  };

/**
 * A stored status as a stage: its category decides the colour, and its name places it
 * within the category (a "Backlog" to-do is dashed, "Review" and "QA" fill further, a done
 * status named "Won't do", "Cancelled" or "Duplicate" is crossed out).
 */
export function statusStage(category: StatusCategoryKey, name = ''): StatusStage {
  if (category === 'todo') return /backlog/i.test(name) ? 'backlog' : 'todo';
  if (category === 'done') return /won.?t|cancel|duplicate|reject/i.test(name) ? 'wont' : 'done';
  if (/review/i.test(name)) return 'review';
  if (/\b(qa|test|verif)/i.test(name)) return 'qa';
  return 'progress';
}

export interface StatusGlyphProps {
  stage: StatusStage;
  /** The status's own name for assistive tech; the stage's name when omitted. */
  label?: string;
  size?: number;
  className?: string;
  /** Beside the status's visible name: hidden from assistive tech so the name is read once. */
  decorative?: boolean;
}

/**
 * A status as a circle that fills as work moves right, coloured by its category only (grey,
 * blue, green), so any custom workflow reads correctly (docs/design/premium/kit.js, `stc`).
 */
export function StatusGlyph({
  stage,
  label,
  size = 14,
  className,
  decorative = false,
}: StatusGlyphProps) {
  const { fill, tone, label: stageLabel } = STAGES[stage];
  const color = `var(--${tone})`;
  const name = label ?? stageLabel;
  let body;
  if (fill === 1) {
    body = (
      <>
        <circle cx="7" cy="7" r="6.25" fill={color} />
        <path
          d="m4.3 7.2 1.8 1.8 3.6-3.8"
          fill="none"
          stroke="var(--on-solid)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    );
  } else if (fill === -1) {
    body = (
      <>
        <circle cx="7" cy="7" r="6.25" fill={color} />
        <path
          d="m4.8 4.8 4.4 4.4M9.2 4.8 4.8 9.2"
          stroke="var(--on-solid)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </>
    );
  } else {
    const r = 3.4;
    const angle = fill * 2 * Math.PI;
    const x = (7 + r * Math.sin(angle)).toFixed(2);
    const y = (7 - r * Math.cos(angle)).toFixed(2);
    body = (
      <>
        <circle
          cx="7"
          cy="7"
          r="5.75"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray={stage === 'backlog' ? '2.2 1.8' : undefined}
        />
        {fill > 0 && (
          <path d={`M7 7V${7 - r}A${r} ${r} 0 ${fill > 0.5 ? 1 : 0} 1 ${x} ${y}Z`} fill={color} />
        )}
      </>
    );
  }
  return (
    <svg
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name })}
      width={size}
      height={size}
      viewBox="0 0 14 14"
      className={cx('inline-block shrink-0', className)}
    >
      {!decorative && <title>{name}</title>}
      {body}
    </svg>
  );
}
