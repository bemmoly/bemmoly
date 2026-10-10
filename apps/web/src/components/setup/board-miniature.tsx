import { Logo } from '@bemmoly/ui';
import type { ThemeScope } from '../../hooks/use-appearance-draft.ts';

const COLUMNS = [
  { tone: 'bg-todo', cards: [1, 0] },
  { tone: 'bg-prog', cards: [0, 1] },
  { tone: 'bg-done', cards: [0] },
] as const;

/** One card: a type tile, a line of title and, on some, an accent avatar. */
function MiniCard({ avatar }: { avatar: boolean }) {
  return (
    <span className="flex h-4.5 items-center gap-1 rounded-tick border border-line bg-card px-1">
      <span className="size-1.5 shrink-0 rounded-tick bg-type-task" />
      <span className="h-1 flex-1 rounded-full bg-line-2" />
      {avatar ? <span className="size-1.5 shrink-0 rounded-full bg-acc" /> : null}
    </span>
  );
}

/**
 * The proposed Board in miniature, painted by the theme itself: the scope sets the preset's (or
 * the custom build's) tokens on this element, and every part below uses token classes, so the
 * tile is the real look, not a drawing of it. The mark keeps its own colours on every theme.
 */
export function BoardMiniature({ scope }: { scope: ThemeScope }) {
  return (
    <span
      {...scope}
      aria-hidden="true"
      className="flex h-22 w-full overflow-hidden rounded-control border border-line bg-canvas"
    >
      <span className="flex w-8 shrink-0 flex-col gap-1 border-r border-line bg-side p-1.5">
        <Logo size={9} label="" />
        <span className="mt-1 h-1.5 rounded-tick bg-hover" />
        <span className="h-1 w-4 rounded-full bg-line-2" />
        <span className="h-1 w-3.5 rounded-full bg-line-2" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-1.5">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-8 rounded-full bg-tx" />
          <span className="ml-auto h-2.5 w-5 rounded-tick bg-acc-fill" />
        </span>
        <span className="grid flex-1 grid-cols-3 gap-1">
          {COLUMNS.map((column, index) => (
            <span key={index} className="flex flex-col gap-1">
              <span className="flex items-center gap-0.5">
                <span className={`size-1.5 rounded-full ${column.tone}`} />
                <span className="h-1 w-4 rounded-full bg-line-2" />
              </span>
              {column.cards.map((avatar, card) => (
                <MiniCard key={card} avatar={avatar === 1} />
              ))}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
