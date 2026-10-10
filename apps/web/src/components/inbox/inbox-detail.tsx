import { actorLabel } from '@bemmoly/core-web';
import type { Notification } from '@bemmoly/shared';
import { Avatar, avatarHue, Button, Menu, MenuItem, RelativeTime, Tooltip } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { snoozeChoices, type InboxView } from '../../hooks/use-inbox-triage.ts';
import { TargetMark } from './inbox-list.tsx';
import { inApp, kindLabel } from './inbox-model.ts';

export interface InboxDetailProps {
  item: Notification;
  view: InboxView;
  onOpen: () => void;
  onDone: () => void;
  onSnooze: (until: Date, label: string) => void;
  onToInbox: () => void;
  onMarkUnread: () => void;
  /** On a phone the detail covers the list; Back returns to it. */
  onBack?: (() => void) | undefined;
}

/** Snooze's choices, from the button or from S. */
export function SnoozeMenu({ onSnooze }: { onSnooze: InboxDetailProps['onSnooze'] }) {
  return (
    <Menu
      align="end"
      widthClassName="w-56"
      trigger={(props) => (
        <Tooltip label="Snooze" keys="S">
          <Button {...props} size="sm" icon={<Icon name="snooze" size={14} />}>
            Snooze
          </Button>
        </Tooltip>
      )}
    >
      {snoozeChoices().map((choice) => (
        <MenuItem
          key={choice.id}
          onSelect={() => onSnooze(choice.until, choice.label)}
          hint={choice.until.toLocaleString('en', {
            weekday: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })}
        >
          {choice.label}
        </MenuItem>
      ))}
    </Menu>
  );
}

/**
 * The item in context (docs/design/premium/screens.js, `screenInbox`): what it is about, who
 * said what and when, then the ways to deal with it without leaving: open it, snooze it, mark
 * it done. Done and Snooze both offer Undo.
 */
export function InboxDetail(props: InboxDetailProps) {
  const { item, view } = props;
  const who = actorLabel(
    item.actors.map((actor) => actor.name),
    item.actorCount,
  );
  const opens = inApp(item.target.url);
  return (
    <article
      aria-label={item.target.label ?? 'Notification'}
      className="flex min-w-0 flex-col gap-5 px-5 py-6 md:px-9"
    >
      <div className="flex flex-wrap items-center gap-2">
        {props.onBack ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<Icon name="back" size={14} />}
            onClick={props.onBack}
          >
            Inbox
          </Button>
        ) : null}
        <TargetMark item={item} size={16} />
        <span className="font-mono text-12 text-tx-3">{item.target.label}</span>
        <span className="rounded-full bg-acc-50 px-2 text-11 leading-5 font-medium text-acc">
          {kindLabel(item.kind)}
        </span>
        <span className="flex-1" />
        {view === 'inbox' ? (
          <>
            <SnoozeMenu onSnooze={props.onSnooze} />
            <Tooltip label="Mark done" keys="E">
              <Button size="sm" icon={<Icon name="archive" size={14} />} onClick={props.onDone}>
                Done
              </Button>
            </Tooltip>
          </>
        ) : (
          <Button size="sm" icon={<Icon name="inbox" size={14} />} onClick={props.onToInbox}>
            Move to inbox
          </Button>
        )}
        {opens ? (
          <Tooltip label="Open" keys="Enter">
            <Button size="sm" variant="primary" onClick={props.onOpen}>
              Open
            </Button>
          </Tooltip>
        ) : null}
      </div>
      <h2 className="m-0 text-20 font-semibold tracking-title text-tx">
        {item.target.label ?? item.summary}
      </h2>
      <div className="flex flex-col gap-3 rounded-card bg-card px-4 py-3.5 shadow-e1">
        <div className="flex flex-wrap items-center gap-2.5 text-13">
          <Avatar
            name={item.actors[0]?.name ?? 'Bemmoly'}
            hue={avatarHue(item.actors[0]?.id ?? item.id)}
            size={24}
          />
          <b className="font-medium">{who}</b>
          <span className="text-tx-3">
            {item.verb} · <RelativeTime iso={item.createdAt} />
          </span>
        </div>
        {item.body ? <p className="m-0 pl-8.5 text-14 leading-body text-tx">{item.body}</p> : null}
      </div>
      {item.read && view === 'inbox' ? (
        <button
          type="button"
          onClick={props.onMarkUnread}
          className="self-start border-0 bg-transparent p-0 font-sans text-12 text-tx-3 hover:text-tx-2 focus-ring"
        >
          Mark unread
        </button>
      ) : null}
    </article>
  );
}
