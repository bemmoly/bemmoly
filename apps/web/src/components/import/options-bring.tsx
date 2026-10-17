import { Checkbox, SettingsSection } from '@bemmoly/ui';
import type { ImportOptions } from '../../hooks/use-import-options.ts';
import { plural } from './import-words.ts';

/** The record kind that always comes, as a locked ticked box. */
const ALWAYS: Record<string, { label: string; description: string }> = {
  issues: { label: 'Issues', description: 'Always; fields, keys, parents and subtasks' },
  pages: { label: 'Pages and page trees', description: 'Always; titles, bodies, labels, parents' },
};

/**
 * What to bring: the records themselves (always on), then each option the source offers with
 * its default. A change is sent at once; the box shows it while the plan answers.
 */
export function OptionsBring({ options }: { options: ImportOptions }) {
  const { nouns, plan } = options;
  const always = ALWAYS[nouns.records] ?? ALWAYS['issues'];
  const chosen = plan?.containers.length ?? 0;
  return (
    <SettingsSection title="What to bring" hint={`For all ${plural(chosen, nouns)}`}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 max-sm:grid-cols-1">
        <Checkbox
          checked
          disabled
          readOnly
          label={always?.label}
          description={always?.description}
        />
        {options.options.map((option) => (
          <Checkbox
            key={option.name}
            checked={options.include[option.name] ?? option.default}
            onChange={(event) => options.toggle(option.name, event.target.checked)}
            label={option.label}
            description={option.description}
          />
        ))}
      </div>
    </SettingsSection>
  );
}
