import type { LqlFieldCatalog } from '@bemmoly/shared';
import { Button, IconButton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { LqlInput } from '../lql/lql-input.tsx';
import type { Problems, RuleDraft } from './model.ts';

interface ConditionsEditorProps {
  conditions: RuleDraft['conditions'];
  catalog: LqlFieldCatalog;
  values: Readonly<Record<string, readonly string[]>>;
  problems: Problems;
  onAdd: () => void;
  onChange: (key: string, query: string) => void;
  onRemove: (key: string) => void;
}

/** "If": queries the issue must match, every one of them, checked as they are typed. */
export function ConditionsEditor(props: ConditionsEditorProps) {
  const { conditions, catalog, values, problems } = props;
  return (
    <div className="flex flex-col gap-2">
      {conditions.length === 0 ? (
        <p className="m-0 text-13 text-tx-3">
          Every issue the trigger fires on. Add a condition to narrow it.
        </p>
      ) : null}
      {conditions.map((condition, index) => (
        <div key={condition.key} className="flex items-start gap-2">
          <span className="w-9 shrink-0 pt-1.5 text-12 text-tx-3">
            {index === 0 ? 'Where' : 'And'}
          </span>
          <div className="min-w-0 flex-1">
            <LqlInput
              aria-label={`Condition ${index + 1}`}
              placeholder="type = Bug AND priority = High"
              value={condition.query}
              catalog={catalog}
              values={values}
              onChange={(query) => props.onChange(condition.key, query)}
            />
            {problems[`conditions.${index}`] && condition.query.trim() === '' ? (
              <span role="alert" className="text-12 text-red-tx">
                {problems[`conditions.${index}`]}
              </span>
            ) : null}
          </div>
          <IconButton
            icon="close"
            size="sm"
            label={`Remove condition ${index + 1}`}
            tip="Remove"
            onClick={() => props.onRemove(condition.key)}
          />
        </div>
      ))}
      {problems['conditions'] ? (
        <span role="alert" className="text-12 text-red-tx">
          {problems['conditions']}
        </span>
      ) : null}
      <div>
        <Button size="sm" variant="ghost" icon={<Icon name="plus" />} onClick={props.onAdd}>
          Add condition
        </Button>
      </div>
    </div>
  );
}
