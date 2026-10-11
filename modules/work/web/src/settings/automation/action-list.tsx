import type { AutomationCatalogEntry } from '@bemmoly/module-work/shared';
import { Button, IconButton, Menu, MenuItem, Select } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { ActionArgs } from './action-args.tsx';
import type { Problems, Step } from './model.ts';
import type { RuleBuilder } from './use-rule-builder.ts';
import type { RuleOptions } from './use-rule-options.ts';

interface ActionListProps {
  actions: readonly Step[];
  catalog: readonly AutomationCatalogEntry[];
  options: RuleOptions;
  problems: Problems;
  builder: Pick<
    RuleBuilder,
    'addAction' | 'changeAction' | 'setActionArgs' | 'moveAction' | 'removeAction'
  >;
}

/** "Then": the actions in the order they run, each with its own arguments. */
export function ActionList({ actions, catalog, options, problems, builder }: ActionListProps) {
  const choices = catalog.map((entry) => ({
    value: entry.name,
    label: entry.label,
    description: entry.description,
    disabled: !entry.available,
  }));
  const labelOf = (name: string) => catalog.find((entry) => entry.name === name)?.label ?? name;
  return (
    <div className="flex flex-col gap-3">
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {actions.map((step, index) => (
          <li
            key={step.key}
            aria-label={`Action ${index + 1}: ${labelOf(step.name)}`}
            className="flex flex-col gap-3 rounded-control border border-line p-3"
          >
            <div className="flex items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sunken text-12 font-semibold text-tx-2 tabular-nums">
                {index + 1}
              </span>
              <Select
                aria-label={`Action ${index + 1}`}
                className="min-w-0 flex-1"
                options={choices}
                value={step.name}
                onChange={(event) => builder.changeAction(step.key, event.value)}
              />
              <IconButton
                icon="arrow-up"
                size="sm"
                label={`Move action ${index + 1} up`}
                tip="Move up"
                disabled={index === 0}
                onClick={() => builder.moveAction(index, -1)}
              />
              <IconButton
                icon="arrow-down"
                size="sm"
                label={`Move action ${index + 1} down`}
                tip="Move down"
                disabled={index === actions.length - 1}
                onClick={() => builder.moveAction(index, 1)}
              />
              <IconButton
                icon="trash"
                size="sm"
                label={`Remove action ${index + 1}`}
                tip="Remove"
                onClick={() => builder.removeAction(step.key)}
              />
            </div>
            <ActionArgs
              step={step}
              at={`actions.${index}`}
              options={options}
              problems={problems}
              onArgs={(args) => builder.setActionArgs(step.key, args)}
            />
          </li>
        ))}
      </ol>
      {problems['actions'] ? (
        <span role="alert" className="text-12 text-red-tx">
          {problems['actions']}
        </span>
      ) : null}
      <div>
        <Menu
          trigger={(props) => (
            <Button {...props} size="sm" variant="secondary" icon={<Icon name="plus" />}>
              Add action
            </Button>
          )}
        >
          {catalog.map((entry) => (
            <MenuItem
              key={entry.name}
              disabled={!entry.available}
              onSelect={() => builder.addAction(entry.name)}
            >
              {entry.label}
            </MenuItem>
          ))}
        </Menu>
      </div>
    </div>
  );
}
