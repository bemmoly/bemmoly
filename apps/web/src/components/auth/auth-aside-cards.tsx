import {
  Avatar,
  EntityTile,
  IssueCard,
  Kbd,
  PriorityGlyph,
  ProgressBar,
  StatusGlyph,
  TypeGlyph,
  type IssueCardProps,
  type StatusStage,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';

/**
 * The still-life cards of the sign-in panel, one per part of Bemmoly: Work (a board, the sprint,
 * the backlog), the Inbox, Docs and AI. Fixed sample text at product sizes (11 to 13px); the
 * panel places and scales them.
 */

type Card = Pick<IssueCardProps, 'issueKey' | 'title' | 'type' | 'priority'> & { who: string };

const COLUMNS: { name: string; stage: StatusStage; cards: Card[] }[] = [
  {
    name: 'To do',
    stage: 'todo',
    cards: [
      { issueKey: 'PLT-212', title: 'Rotate signing keys', type: 'task', who: 'Priya N.' },
      { issueKey: 'PLT-219', title: 'Session list in Settings', type: 'story', who: 'Amir K.' },
    ],
  },
  {
    name: 'In progress',
    stage: 'progress',
    cards: [
      {
        issueKey: 'PLT-204',
        title: 'SAML metadata refresh',
        type: 'story',
        priority: 'high',
        who: 'Rohan S.',
      },
      { issueKey: 'PLT-198', title: 'Lockout after ten tries', type: 'bug', who: 'Jonas M.' },
    ],
  },
  {
    name: 'Done',
    stage: 'done',
    cards: [
      { issueKey: 'PLT-190', title: 'OIDC discovery and PKCE', type: 'story', who: 'Priya N.' },
      { issueKey: 'PLT-188', title: 'Remember last method', type: 'task', who: 'Amir K.' },
    ],
  },
];

export const FLOAT = 'absolute rounded-card bg-card shadow-e2 motion-safe:animate-drift';

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

/** A card's small header: an icon or tile, a bold name and an optional right-hand note. */
function CardHead({ lead, name, note }: { lead: React.ReactNode; name: string; note?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-12">
      {lead}
      <b className="font-semibold">{name}</b>
      {note ? <span className="ml-auto text-11 text-tx-3">{note}</span> : null}
    </div>
  );
}

export function BoardCard({ className }: { className: string }) {
  return (
    <div className={cx(FLOAT, 'overflow-hidden bg-canvas', className)}>
      <div className="flex h-8 items-center gap-1.5 border-b border-line px-3 text-tx-3">
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="size-2 rounded-full bg-line" />
        ))}
        <span className="ml-2 font-mono text-11">Auth service · Board</span>
        <span className="ml-auto flex -space-x-1">
          {['Priya N.', 'Amir K.', 'Jonas M.', 'Lena T.'].map((name) => (
            <Avatar key={name} name={name} size={18} ring="bg" />
          ))}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 bg-sunken p-3">
        {COLUMNS.map((column) => (
          <div key={column.name} className="flex min-w-0 flex-col gap-1.5">
            <div className="mx-0.5 flex items-center gap-1.5 text-11">
              <StatusGlyph stage={column.stage} size={12} decorative />
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
  );
}

export function SprintCard({ className }: { className: string }) {
  return (
    <div className={cx(FLOAT, 'flex flex-col gap-2 px-3.5 py-3', className)}>
      <CardHead
        lead={<Icon name="sprint" size={14} className="text-tx-3" />}
        name="Sprint 14"
        note="6 days left"
      />
      <ProgressBar value={69} size="md" label="Sprint progress" />
      <div className="flex items-center justify-between text-11 text-tx-2 tabular-nums">
        <span>18 of 26 points done</span>
        <span className="text-green-tx">On track</span>
      </div>
    </div>
  );
}

const INBOX = [
  {
    who: 'Amir K.',
    what: (
      <>
        mentioned you: <b className="font-semibold text-acc">@Priya</b> can you review the lockout
        copy?
      </>
    ),
    when: '2m',
    unread: true,
  },
  { who: 'Jonas M.', what: <>moved PLT-198 to In review</>, when: '1h', unread: true },
  { who: 'Lena T.', what: <>commented on Single sign-on runbook</>, when: '3h', unread: false },
];

export function InboxCard({ className }: { className: string }) {
  return (
    <div className={cx(FLOAT, 'flex flex-col gap-1 px-3.5 py-3', className)}>
      <CardHead
        lead={<Icon name="inbox" size={14} className="text-tx-3" />}
        name="Inbox"
        note="2 new"
      />
      {INBOX.map((row) => (
        <div key={row.who} className="flex items-start gap-2 py-1.5 text-12 leading-body">
          <Avatar name={row.who} size={20} />
          <p className="m-0 min-w-0 flex-1 text-tx-2">
            <b className="font-semibold text-tx">{row.who}</b> {row.what}
          </p>
          <span className="flex items-center gap-1 text-11 text-tx-3">
            {row.when}
            <span
              className={cx('size-1.5 rounded-full', row.unread ? 'bg-acc' : 'bg-transparent')}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

export function DocCard({ className }: { className: string }) {
  return (
    <div
      className={cx(FLOAT, 'flex flex-col gap-2 px-4 py-3.5', className)}
      style={{ ['--drift-x' as string]: '3px', ['--drift-y' as string]: '-4px' }}
    >
      <div className="flex items-center gap-1.5 text-11 text-tx-3">
        <EntityTile name="Docs" icon="doc" tone="docs" size={16} />
        Engineering · Runbooks
      </div>
      <b className="text-14 font-semibold">Single sign-on runbook</b>
      <p className="m-0 text-12 leading-body text-tx-2">
        Every workspace can sign in with OpenID Connect or SAML. Admins keep a password as the
        fallback.
      </p>
      <b className="relative mt-1 text-13 font-semibold">
        Rotating the certificate
        <span className="absolute -top-2 right-6 flex items-start gap-0.5 text-avatar-orange">
          <Icon name="pointer" size={12} />
          <span className="mt-2.5 rounded-chip bg-avatar-orange px-1.5 py-0.5 text-11 font-semibold whitespace-nowrap text-on-solid">
            Priya
          </span>
        </span>
      </b>
      <p className="m-0 text-12 leading-body text-tx-2">
        Upload the new certificate a week early; the refresh job warns 30 days before expiry.
      </p>
    </div>
  );
}

const BACKLOG = [
  { key: 'PLT-224', title: 'SCIM group sync', type: 'story', priority: 'medium', pts: 3 },
  { key: 'PLT-226', title: 'Passkeys for admins', type: 'story', priority: 'low', pts: 5 },
  { key: 'PLT-227', title: 'Expired link shows 500', type: 'bug', priority: 'high', pts: 1 },
] as const;

export function BacklogCard({ className }: { className: string }) {
  return (
    <div className={cx(FLOAT, 'flex flex-col px-3.5 py-3', className)}>
      <CardHead
        lead={<Icon name="backlog" size={14} className="text-tx-3" />}
        name="Backlog"
        note="12 issues"
      />
      <div className="mt-1.5">
        {BACKLOG.map((row) => (
          <div
            key={row.key}
            className="flex h-8 items-center gap-2 border-t border-line-2 text-12 first:border-t-0"
          >
            <TypeGlyph type={row.type} size={14} />
            <span className="font-mono text-11 text-tx-3">{row.key}</span>
            <span className="min-w-0 flex-1 truncate">{row.title}</span>
            <PriorityGlyph priority={row.priority} size={13} />
            <span className="w-4 text-right font-mono text-11 text-tx-3">{row.pts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AiCard({ className }: { className: string }) {
  return (
    <div
      className={cx(FLOAT, 'border-l-3 border-ai bg-ai-50 px-3.5 py-3', className)}
      style={{ ['--drift-y' as string]: '6px', ['--drift-period' as string]: '11s' }}
    >
      <div className="flex items-center gap-1.5 text-12 text-ai-600">
        <Icon name="spark" size={14} />
        <b className="font-semibold">AI summary</b>
        <span className="ml-auto rounded-full bg-card px-1.75 text-11 font-semibold text-tx-2">
          Example
        </span>
      </div>
      <p className="m-0 mt-1.5 text-12 leading-body text-tx">
        Two of five sign-in tasks are done. PLT-198 blocks the GA checklist; Jonas expects a fix
        Thursday.
      </p>
    </div>
  );
}

export function SearchChip({ className }: { className: string }) {
  return (
    <div
      className={cx(
        'absolute flex h-7 items-center gap-2 rounded-control bg-card pr-3 pl-1.5 text-12 text-tx-3 shadow-e2',
        className,
      )}
    >
      <Kbd keys="Mod+K" />
      Search or jump to…
    </div>
  );
}
