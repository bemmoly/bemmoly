import {
  Avatar,
  EntityTile,
  IssueCard,
  Kbd,
  PriorityGlyph,
  StatusGlyph,
  TypeGlyph,
  type IssueCardProps,
  type StatusStage,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useFitScale } from '../../hooks/use-fit-scale.ts';

type Card = Pick<IssueCardProps, 'issueKey' | 'title' | 'type' | 'priority'> & { who: string };

const COLUMNS: { name: string; stage: StatusStage; cards: Card[] }[] = [
  {
    name: 'To do',
    stage: 'todo',
    cards: [
      {
        issueKey: 'PLT-212',
        title: 'Rotate signing keys before GA',
        type: 'task',
        who: 'Priya N.',
      },
      { issueKey: 'PLT-219', title: 'Session list in Settings', type: 'story', who: 'Amir K.' },
      { issueKey: 'PLT-221', title: 'Audit log export', type: 'task', who: 'Lena T.' },
    ],
  },
  {
    name: 'In progress',
    stage: 'progress',
    cards: [
      {
        issueKey: 'PLT-204',
        title: 'SAML metadata refresh job',
        type: 'story',
        priority: 'high',
        who: 'Rohan S.',
      },
      {
        issueKey: 'PLT-198',
        title: 'Lockout after ten failed sign-ins',
        type: 'bug',
        who: 'Jonas M.',
      },
    ],
  },
  {
    name: 'Done',
    stage: 'done',
    cards: [
      { issueKey: 'PLT-190', title: 'OIDC discovery and PKCE', type: 'story', who: 'Priya N.' },
      {
        issueKey: 'PLT-188',
        title: 'Remember the last sign-in method',
        type: 'task',
        who: 'Amir K.',
      },
    ],
  },
];

/** The two arrangements from the review: wide panels (frames from 1300px) and narrow ones. */
const STAGES = {
  wide: { w: 720, h: 590 },
  narrow: { w: 600, h: 720 },
} as const;

const PLACE = {
  wide: {
    win: 'left-5 top-17.5 w-150',
    peek: 'right-0 top-0 w-75',
    doc: '-left-1.5 top-98 w-72.5',
    ai: 'right-2.5 top-110 w-77.5',
    search: 'left-57.5 top-3.5',
  },
  narrow: {
    win: 'left-0 top-21 w-145',
    peek: 'right-0 top-0 w-70',
    doc: 'left-1.5 bottom-0 w-67.5',
    ai: 'right-0 bottom-10 w-72.5',
    search: 'left-7.5 top-5',
  },
} as const;

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

const FLOAT = 'absolute rounded-card bg-card shadow-e2 motion-safe:animate-drift';

/**
 * The right-hand panel of the sign-in pages: a still life of the product in the workspace's own
 * theme (a board, an issue peek, a doc with a collaborator's cursor, an AI summary marked as an
 * example, the ⌘K chip). Fixed sample text, hidden from assistive tech, drifting gently unless
 * motion is reduced. It never shows workspace data: nobody is signed in yet.
 */
export function AuthAside({ className }: { className?: string }) {
  const { ref, width, scale } = useFitScale(STAGES);
  const layout = width !== null && width < 800 ? 'narrow' : 'wide';
  const stage = STAGES[layout];
  const at = PLACE[layout];
  return (
    <aside
      ref={ref}
      aria-hidden="true"
      className={cx(
        'relative place-items-center overflow-hidden border-l border-line bg-sunken',
        className,
      )}
    >
      <div className="auth-grid pointer-events-none absolute inset-0 opacity-55" />
      <div className="relative" style={{ width: stage.w * scale, height: stage.h * scale }}>
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: stage.w, height: stage.h, transform: `scale(${scale})` }}
        >
          <div className={cx(FLOAT, '-rotate-[1.5deg] overflow-hidden bg-canvas', at.win)}>
            <div className="flex h-8.5 items-center gap-1.5 border-b border-line px-3 text-tx-3">
              {[0, 1, 2].map((dot) => (
                <span key={dot} className="size-2.25 rounded-full bg-line" />
              ))}
              <span className="ml-2 font-mono text-11">Auth service · Board</span>
              <span className="ml-auto flex -space-x-1.25">
                {['Priya N.', 'Amir K.', 'Jonas M.'].map((name) => (
                  <Avatar key={name} name={name} size={18} ring="bg" />
                ))}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 bg-sunken p-3.5">
              {COLUMNS.map((column) => (
                <div key={column.name} className="flex flex-col gap-2">
                  <div className="mx-0.5 flex items-center gap-1.5 text-12">
                    <StatusGlyph stage={column.stage} size={13} decorative />
                    <b className="font-semibold">{column.name}</b>
                    <span className="text-tx-3">{column.cards.length}</span>
                  </div>
                  {column.cards.map((card) => (
                    <IssueCard
                      key={card.issueKey}
                      issueKey={card.issueKey}
                      showKey
                      title={card.title}
                      type={card.type}
                      priority={card.priority}
                      assignee={{ name: card.who }}
                      density="compact"
                      interactive={false}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div
            className={cx(FLOAT, 'flex rotate-[1.2deg] flex-col gap-2 px-4 py-3.5', at.peek)}
            style={{ ['--drift-y' as string]: '8px', ['--drift-period' as string]: '11s' }}
          >
            <div className="flex items-center gap-1.5 text-tx-3">
              <TypeGlyph type="story" size={16} />
              <span className="font-mono text-11">PLT-204</span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-sunken px-1.75 text-11 text-tx-2">
                <StatusGlyph stage="progress" size={12} decorative />
                In progress
              </span>
            </div>
            <b className="text-14 font-semibold">SAML metadata refresh job</b>
            <p className="m-0 text-12 leading-body text-tx-2">
              Fetch the identity provider’s metadata nightly and warn admins 30 days before the
              certificate expires.
            </p>
            <div className="flex items-center gap-3 text-11 text-tx-2">
              <span className="inline-flex items-center gap-1.25">
                <Avatar name="Rohan S." size={18} />
                Rohan S.
              </span>
              <span className="inline-flex items-center gap-1.25">
                <PriorityGlyph priority="high" size={14} />
                High
              </span>
              <span className="font-mono">5 pts</span>
            </div>
          </div>

          <div
            className={cx(FLOAT, '-rotate-[0.8deg]', at.doc)}
            style={{ ['--drift-x' as string]: '4px', ['--drift-y' as string]: '-5px' }}
          >
            <div className="h-15.5 rounded-t-card bg-linear-120 from-brand-1 to-brand-2" />
            <div className="flex flex-col gap-2 px-4 pt-3 pb-4">
              <div className="flex items-center gap-2 text-13">
                <EntityTile name="Docs" icon="doc" tone="docs" size={16} />
                <b className="font-semibold">Single sign-on runbook</b>
              </div>
              <span className="h-1.5 w-[94%] rounded-full bg-line" />
              <span className="h-1.5 w-[72%] rounded-full bg-line" />
            </div>
            <div className="absolute top-25 -right-19.5 flex items-start gap-0.5 text-avatar-orange">
              <Icon name="pointer" size={14} />
              <span className="mt-3 rounded-chip bg-avatar-orange px-1.75 py-0.5 text-11 font-semibold whitespace-nowrap text-on-solid">
                Priya is editing
              </span>
            </div>
          </div>

          <div
            className={cx(FLOAT, 'border-l-3 border-ai bg-ai-50 px-3.5 py-3', at.ai)}
            style={{ ['--drift-y' as string]: '8px', ['--drift-period' as string]: '11s' }}
          >
            <div className="flex items-center gap-1.5 text-12 text-ai-600">
              <Icon name="spark" size={14} />
              <b className="font-semibold">AI summary</b>
              <span className="ml-auto rounded-full bg-card px-1.75 text-11 font-semibold text-tx-2">
                Example
              </span>
            </div>
            <p className="m-0 mt-1.5 text-12 leading-body text-tx">
              Two of five sign-in tasks are done. PLT-198 blocks the GA checklist; Jonas expects a
              fix Thursday.
            </p>
          </div>

          <div
            className={cx(
              'absolute flex h-7.5 items-center gap-2 rounded-control bg-card pr-3 pl-1.5 text-12 text-tx-3 shadow-e2',
              at.search,
            )}
          >
            <Kbd keys="Mod+K" />
            Search or jump to…
          </div>
        </div>
      </div>
    </aside>
  );
}
