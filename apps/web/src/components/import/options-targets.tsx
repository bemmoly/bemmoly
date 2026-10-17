import { Button, SettingsSection, Skeleton } from '@bemmoly/ui';
import { useId } from 'react';
import type { ImportOptions } from '../../hooks/use-import-options.ts';
import { FormError } from '../form.tsx';
import { DisclosureButton } from './disclosure-button.tsx';
import { count } from './import-words.ts';
import { TargetRow } from './target-row.tsx';

/** "Jira project → Work project". */
const directionOf = (options: ImportOptions) =>
  `${options.label} ${options.nouns.container} to ${options.nouns.target}`;

/**
 * Where each project or space goes: the rows that want a look first (a clash, an existing
 * target, an update, a new key), then "Show N more" for the rest, all new with their own key.
 */
export function OptionsTargets({ options }: { options: ImportOptions }) {
  const { targets, nouns } = options;
  const moreId = useId();
  const others = Math.max(0, targets.total - targets.top.length);
  return (
    <SettingsSection title={`Where each ${nouns.container} goes`} hint={directionOf(options)}>
      <FormError error={targets.error} />
      {targets.loading ? (
        <div
          role="status"
          aria-label={`Loading ${nouns.containers}`}
          className="flex flex-col gap-3"
        >
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <>
          {targets.top.length > 0 ? (
            <ul
              aria-label={`${nouns.containers} to check`}
              className="m-0 flex list-none flex-col p-0"
            >
              {targets.top.map((row) => (
                <TargetRow key={row.id} row={row} options={options} />
              ))}
            </ul>
          ) : null}
          {others > 0 ? (
            <DisclosureButton
              expanded={targets.expanded}
              controls={moreId}
              onToggle={targets.toggle}
            >
              {targets.expanded
                ? `Hide the other ${count(others)}`
                : `Show ${count(others)} ${targets.top.length ? 'more ' : ''}${
                    others === 1 ? nouns.container : nouns.containers
                  }, all new with their own key`}
            </DisclosureButton>
          ) : null}
          <div id={moreId} hidden={!targets.expanded}>
            {targets.expanded ? (
              <ul
                aria-label={`Other ${nouns.containers}`}
                className="m-0 flex list-none flex-col p-0"
              >
                {targets.rest.map((row) => (
                  <TargetRow key={row.id} row={row} options={options} />
                ))}
              </ul>
            ) : null}
            {targets.expanded && targets.hasMore ? (
              <Button size="sm" variant="ghost" onClick={targets.loadMore}>
                Show more
              </Button>
            ) : null}
          </div>
        </>
      )}
    </SettingsSection>
  );
}
