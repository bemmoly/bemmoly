import {
  CommandFooter,
  CommandGlyph,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPalette,
  CommandPlan,
  CommandScopes,
} from '@bemmoly/ui';
import plan from '../../fixtures/command-plan.json' with { type: 'json' };
import type { PaletteItem } from '../../hooks/command-items.ts';
import { SCOPES, useCommandPalette } from '../../hooks/use-command-palette.ts';
import { toast } from '../../lib/toast.ts';

const steps = plan.rows.map((row) => ({
  target: row.issue,
  change: row.change,
  field: row.field ?? (
    <>
      {row.from} → <b className="font-semibold">{row.to}</b>
    </>
  ),
  allowed: row.permission === 'ALLOWED',
}));

/**
 * ⌘K from the Command mock: search people and settings pages, run actions,
 * or, when the query reads as a request, the plan table rendered from a
 * fixture until the AI runtime ships. Keyboard handling is the palette's own.
 */
export default function CommandPaletteHost() {
  const palette = useCommandPalette();
  const hint = (q: string) => (
    <button
      type="button"
      onClick={() => palette.setQuery(q)}
      className="cursor-pointer border-0 bg-transparent p-0 font-sans text-12 text-ac"
    >
      “{q}”
    </button>
  );
  return (
    <CommandPalette open onClose={palette.close}>
      <CommandInput value={palette.query} onValueChange={palette.setQuery} autoFocus />
      <CommandScopes scopes={SCOPES} value={palette.scope} onChange={palette.setScope} />
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
            <p className="m-0 px-4 py-6 text-center text-12h text-tx5">
              Nothing matches. Try a person's name or a settings page.
            </p>
          ) : (
            palette.groups.map((group) => (
              <CommandGroup key={group.name} label={group.name}>
                {(group.items as PaletteItem[]).map((item) => (
                  <CommandItem
                    key={item.id}
                    icon={
                      group.name === 'People' ? (
                        <CommandGlyph
                          glyph={item.title.charAt(0).toUpperCase()}
                          tone="accent"
                          round
                        />
                      ) : (
                        <CommandGlyph
                          glyph={item.glyph}
                          tone={item.glyph === '+' ? 'accent' : 'neutral'}
                        />
                      )
                    }
                    title={item.title}
                    {...(item.subtitle ? { meta: item.subtitle } : {})}
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
          <>
            Try: {hint('backups')} · {hint('invite')}
          </>
        }
      />
    </CommandPalette>
  );
}
