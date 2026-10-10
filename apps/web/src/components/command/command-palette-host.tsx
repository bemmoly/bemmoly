import {
  Avatar,
  avatarHue,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPalette,
  CommandPlan,
  CommandScopes,
  Kbd,
} from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import plan from '../../fixtures/command-plan.json' with { type: 'json' };
import type { PaletteItem } from '../../hooks/command-items.ts';
import { useCommandPalette } from '../../hooks/use-command-palette.ts';
import { toast } from '../../lib/toast.ts';
import { RecentMark, RecentStatus } from '../shell/recent-mark.tsx';
import { Marked, PlaceChip } from './palette-parts.tsx';

const steps = plan.rows.map((row) => ({
  target: row.issue,
  change: row.change,
  field: row.field ?? (
    <span className="inline-flex items-center gap-1">
      {row.from}
      <Icon name="arrow" size={12} label="to" />
      <b className="font-semibold">{row.to}</b>
    </span>
  ),
  allowed: row.permission === 'ALLOWED',
}));

/** Each row's own mark: a person's avatar, an issue's type tile, or the place's icon. */
function Mark({ item }: { item: PaletteItem }) {
  if (item.person) return <Avatar name={item.title} hue={avatarHue(item.id)} size={18} />;
  if (item.look) return <RecentMark look={item.look} />;
  if (item.recordIcon !== undefined) return <PageIcon value={item.recordIcon} size={16} />;
  return <Icon name={item.icon ?? 'chevron'} size={16} />;
}

/** What sits on the right of a row: an issue's status, or where the thing lives. */
function Meta({ item }: { item: PaletteItem }) {
  const status = <RecentStatus look={item.look} />;
  if (item.look?.kind === 'issue' && item.look.status) {
    return (
      <>
        {status}
        {item.subtitle && !item.fromServer ? (
          <span className="truncate">{item.subtitle}</span>
        ) : null}
      </>
    );
  }
  return item.subtitle && item.group !== 'Settings' ? (
    <span className="max-w-55 truncate">{item.subtitle}</span>
  ) : null;
}

/**
 * ⌘K (docs/design/premium/screens.js, `screenPalette`). Empty, it offers what was opened
 * recently, what this screen can do and where to go; typing searches everything the person can
 * reach. Tab filters by type. The AI dot and the plan preview appear only when AI is on.
 */
export default function CommandPaletteHost() {
  const palette = useCommandPalette();
  return (
    <CommandPalette open onClose={palette.close} onTab={palette.cycleScope}>
      <CommandInput
        value={palette.query}
        onValueChange={palette.setQuery}
        ai={palette.ai}
        autoFocus
        trailing={
          palette.place && <PlaceChip label={palette.place.label} onClear={palette.clearPlace} />
        }
        onKeyDown={(event) => {
          if (event.key === 'Backspace' && !palette.query && palette.place) palette.clearPlace();
        }}
      />
      <CommandScopes scopes={palette.scopes} value={palette.scope} onChange={palette.setScope} />
      {palette.isCommand ? (
        <CommandPlan
          summary={plan.summary}
          steps={steps}
          onRun={() => toast('AI plans arrive with the AI runtime in a later release.', 'info')}
          footnote="Preview only: nothing runs until the AI runtime ships."
        />
      ) : (
        <CommandList>
          {palette.groups.length === 0 ? (
            <p className="m-0 px-4 py-6 text-center text-13 text-tx-3">
              Nothing matches “{palette.query.trim()}”. Try an issue key, a person’s name or a page.
            </p>
          ) : (
            palette.groups.map((group) => (
              <CommandGroup key={group.name} label={group.name}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    icon={<Mark item={item} />}
                    {...(item.issueKey ? { issueKey: item.issueKey } : {})}
                    title={
                      item.fromServer ? (
                        <Marked text={item.title} query={palette.query} />
                      ) : (
                        item.title
                      )
                    }
                    {...(item.snippet ? { detail: <Marked text={item.snippet} /> } : {})}
                    meta={<Meta item={item} />}
                    {...(item.keys ? { keys: item.keys } : {})}
                    onSelect={() => palette.open(item)}
                  />
                ))}
              </CommandGroup>
            ))
          )}
        </CommandList>
      )}
      <CommandFooter
        extra={
          <button
            type="button"
            onClick={palette.openShortcuts}
            className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-sans text-12 text-tx-3 hover:text-tx-2"
          >
            <Kbd keys="?" />
            all shortcuts
          </button>
        }
      />
    </CommandPalette>
  );
}
