import { useCurrentScreenActions, useT } from '@bemmoly/core-web';
import type { Application } from '@bemmoly/module-pipelines/shared';
import { CommandGroup, CommandItem } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import { pipelinesText } from '../i18n/catalog.ts';

export type Verb = 'run' | 'rollback' | 'owner' | 'promote';

/**
 * "roll back pricing-svc", "run checkout-api", "who owns search-api": a verb in front narrows
 * the palette to that action for the applications the rest of the words find.
 */
const VERBS: readonly (readonly [RegExp, Verb])[] = [
  [/^(roll ?back|revert)\s+/i, 'rollback'],
  [/^(run|build)\s+/i, 'run'],
  [/^who owns\s+/i, 'owner'],
  [/^(promote|deploy|ship)\s+/i, 'promote'],
];

export function parseIntent(query: string): { verb: Verb | null; rest: string } {
  for (const [pattern, verb] of VERBS) {
    if (pattern.test(query)) return { verb, rest: query.replace(pattern, '').trim() };
  }
  return { verb: null, rest: query };
}

const ICONS: Record<Verb, IconName> = {
  run: 'play',
  rollback: 'undo',
  owner: 'people',
  promote: 'rocket',
};

/** What the screen on show can do, first while the palette is empty or matches it. */
export function ScreenActionsGroup({ query, onRun }: { query: string; onRun: () => void }) {
  const t = useT(pipelinesText);
  const actions = useCurrentScreenActions().filter((action) =>
    action.title.toLowerCase().includes(query.toLowerCase()),
  );
  if (actions.length === 0) return null;
  return (
    <CommandGroup label={t('pipelines.shell.commandsScreen')}>
      {actions.map((action) => (
        <CommandItem
          key={action.id}
          icon={<Icon name="command" size={16} />}
          title={action.title}
          {...(action.keys ? { keys: action.keys } : {})}
          onSelect={() => {
            onRun();
            action.run();
          }}
        />
      ))}
    </CommandGroup>
  );
}

/** The actions an application offers from anywhere: run, roll back, promote, who owns it. */
export function ApplicationActionsGroup({
  applications,
  verb,
  onOpen,
}: {
  applications: readonly Application[];
  verb: Verb | null;
  onOpen: (application: Application, dialog: Verb) => void;
}) {
  const t = useT(pipelinesText);
  const verbs: Verb[] = verb ? [verb] : ['run', 'rollback', 'owner'];
  const targets = verb ? applications.slice(0, 5) : applications.slice(0, 1);
  if (targets.length === 0) return null;
  return (
    <CommandGroup label={t('pipelines.shell.commandsApplicationActions')}>
      {targets.flatMap((application) =>
        verbs.map((each) => (
          <CommandItem
            key={`${application.id}-${each}`}
            icon={<Icon name={ICONS[each]} size={16} />}
            title={t(`pipelines.shell.verb.${each}`, { name: application.name })}
            {...(each === 'owner'
              ? {
                  meta: application.ownerTeam?.name ?? t('pipelines.catalog.noOwner'),
                }
              : {})}
            onSelect={() => onOpen(application, each)}
          />
        )),
      )}
    </CommandGroup>
  );
}
