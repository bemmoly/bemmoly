import { useFitScale } from '../../hooks/use-fit-scale.ts';
import {
  AiCard,
  BacklogCard,
  BoardCard,
  DocCard,
  InboxCard,
  SearchChip,
  SprintCard,
} from './auth-aside-cards.tsx';

/**
 * Two arrangements: wide panels (from 800px) and narrow ones (1100 to 1300px windows). The
 * drawing never grows past 92%, so its text stays at product sizes (11 to 13px) on large
 * screens and the panel keeps its whitespace.
 */
const STAGES = {
  wide: { w: 780, h: 600 },
  narrow: { w: 600, h: 660 },
} as const;
const MAX_SCALE = 0.92;

/** Cards sit in two loose columns with gutters; only the search chip overlaps an edge. */
const PLACE = {
  wide: {
    board: 'left-0 top-6 w-115 -rotate-[0.6deg]',
    search: 'left-40 top-0',
    sprint: 'left-122.5 top-0 w-67.5',
    inbox: 'left-122.5 top-27.5 w-67.5 rotate-[0.5deg]',
    doc: 'left-2.5 top-72.5 w-95 -rotate-[0.4deg]',
    backlog: 'left-105 top-84 w-85',
    ai: 'left-105 top-123 w-85 rotate-[0.4deg]',
  },
  narrow: {
    board: 'left-0 top-6 w-150 -rotate-[0.4deg]',
    search: 'left-6 top-0',
    sprint: 'left-85 top-133 w-65',
    inbox: 'left-85 top-72.5 w-65 rotate-[0.5deg]',
    doc: 'left-0 top-72.5 w-80 -rotate-[0.4deg]',
    backlog: 'hidden',
    ai: 'left-0 top-127.5 w-80',
  },
} as const;

/**
 * The right-hand panel of the sign-in pages: a glimpse of Bemmoly in the workspace's own theme
 * (a board, the sprint, the inbox with a mention, a doc being edited, the backlog, an AI
 * summary marked as an example, the ⌘K chip). Fixed sample text, hidden from assistive tech,
 * drifting gently unless motion is reduced. It never shows workspace data: nobody is signed in.
 */
export function AuthAside({ className }: { className?: string }) {
  const { ref, width, scale } = useFitScale(STAGES, MAX_SCALE);
  const layout = width !== null && width < 800 ? 'narrow' : 'wide';
  const stage = STAGES[layout];
  const at = PLACE[layout];
  return (
    <aside
      ref={ref}
      aria-hidden="true"
      className={`relative place-items-center overflow-hidden border-l border-line bg-sunken ${className ?? ''}`}
    >
      <div className="auth-grid pointer-events-none absolute inset-0 opacity-55" />
      <div className="relative" style={{ width: stage.w * scale, height: stage.h * scale }}>
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: stage.w, height: stage.h, transform: `scale(${scale})` }}
        >
          <BoardCard className={at.board} />
          <SprintCard className={at.sprint} />
          <InboxCard className={at.inbox} />
          <DocCard className={at.doc} />
          <BacklogCard className={at.backlog} />
          <AiCard className={at.ai} />
          <SearchChip className={at.search} />
        </div>
      </div>
    </aside>
  );
}
