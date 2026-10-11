import {
  Avatar,
  avatarHue,
  CommandAiLine,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPalette,
  CommandScopes,
  Kbd,
} from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import type { PaletteItem } from '../../hooks/command-items.ts';
import { useCommandPalette } from '../../hooks/use-command-palette.ts';
import type { PaletteAi } from '../../hooks/use-palette-ai.ts';
import { RecentMark, RecentStatus } from '../shell/recent-mark.tsx';
import { PaletteAiPanel } from './palette-ai.tsx';
import { Marked, PlaceChip } from './palette-parts.tsx';

/** The AI line: the typed words handed to Bemmoly, a result row like any other. */
function AiLine({ ai, query }: { ai: PaletteAi; query: string }) {
  if (!ai.line) return null;
  return <CommandAiLine label={ai.line.label} query={query.trim()} onSelect={ai.start} />;
}

/** The footer's keys follow what Enter does now. */
function hintsFor(ai: PaletteAi) {
  if (ai.mode === 'plan' && ai.plan.plan?.status === 'proposed' && ai.plan.plan.runnable) {
    return [
      { keys: 'Enter', label: 'run' },
      { keys: 'Esc', label: 'close' },
    ];
  }
  if (ai.active) return [{ keys: 'Esc', label: 'close' }];
  return [
    { keys: 'Up Down', label: 'move' },
    { keys: 'Enter', label: 'open' },
    ...(ai.line ? [{ keys: 'Mod+Enter', label: ai.line.label.split(' ')[0]!.toLowerCase() }] : []),
    { keys: 'Tab', label: 'filter by type' },
  ];
}

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
    <CommandPalette
      open
      onClose={palette.close}
      {...(palette.ai.active ? {} : { onTab: palette.cycleScope })}
    >
      <CommandInput
        value={palette.query}
        onValueChange={palette.setQuery}
        ai={palette.ai.enabled}
        expanded={!palette.ai.active}
        autoFocus
        trailing={
          palette.place && <PlaceChip label={palette.place.label} onClear={palette.clearPlace} />
        }
        onKeyDown={(event) => {
          palette.ai.onKeyDown(event);
          if (event.key === 'Backspace' && !palette.query && palette.place) palette.clearPlace();
        }}
      />
      {!palette.ai.active && (
        <CommandScopes scopes={palette.scopes} value={palette.scope} onChange={palette.setScope} />
      )}
      {palette.ai.active ? (
        <PaletteAiPanel ai={palette.ai} />
      ) : (
        <CommandList>
          {palette.ai.line?.first && <AiLine ai={palette.ai} query={palette.query} />}
          {palette.groups.length === 0 && !palette.ai.line ? (
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
          {palette.ai.line && !palette.ai.line.first && (
            <AiLine ai={palette.ai} query={palette.query} />
          )}
        </CommandList>
      )}
      <CommandFooter
        hints={hintsFor(palette.ai)}
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
