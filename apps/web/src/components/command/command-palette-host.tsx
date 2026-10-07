import { useId } from 'react';
import { SCOPES, useCommandPalette } from '../../hooks/use-command-palette.ts';
import { CommandPalette } from '../../ui.ts';
import { CommandResults } from './command-results.tsx';
import { PlanPreview } from './plan-preview.tsx';

/** ⌘K: search people and settings, or preview a plan when the query reads as a request. */
export default function CommandPaletteHost() {
  const palette = useCommandPalette();
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;
  const showPlan = palette.isCommand;
  return (
    <CommandPalette
      open
      onClose={palette.close}
      query={palette.query}
      onQueryChange={palette.setQuery}
      onKeyDown={palette.navigation.onKeyDown}
      listId={listId}
      activeDescendant={showPlan ? undefined : optionId(palette.navigation.activeIndex)}
      scopes={SCOPES.map((scope) => {
        const active = scope.id === palette.scope;
        return (
          <button
            key={scope.id}
            type="button"
            aria-pressed={active}
            onClick={() => palette.setScope(scope.id)}
            className={`cursor-pointer rounded-dialog border px-2.5 py-1 font-sans text-caption font-medium ${
              active ? 'border-ac bg-ac-bg text-ac' : 'border-br bg-sf text-tx2'
            }`}
          >
            {scope.label}
          </button>
        );
      })}
      footerAside={
        <>
          Try:{' '}
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 font-sans text-caption text-ac"
            onClick={() => palette.setQuery('backups')}
          >
            "backups"
          </button>{' '}
          ·{' '}
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 font-sans text-caption text-ac"
            onClick={() => palette.setQuery('invite')}
          >
            "invite"
          </button>
        </>
      }
    >
      {showPlan ? <PlanPreview /> : null}
      <CommandResults
        listId={listId}
        groups={palette.groups}
        visible={palette.visible}
        activeIndex={palette.navigation.activeIndex}
        optionId={optionId}
        onHover={palette.navigation.setActiveIndex}
        onOpen={palette.open}
        hidden={showPlan}
      />
    </CommandPalette>
  );
}
