import type { BoardConfig, CardColorRuleEntry } from '@bemmoly/module-work/shared';
import type { LqlFieldCatalog } from '@bemmoly/shared';
import { Card } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { HUE_PAIRS, SIGNAL_SOLIDS } from '@bemmoly/ui/tokens';
import { cx } from '../cx.ts';
import { LqlInput } from '../lql/lql-input.tsx';
import { COLOR_RULE_LABELS } from '../model/labels.ts';

const PRESETS: [BoardConfig['colorRule'], string][] = [
  ['none', ''],
  ['priority', 'red to green stripe'],
  ['type', 'story / bug / task'],
  ['epic', 'matches lane color'],
];

/** Rule colours are stored as hex on the board, so they come from the token palette. */
export const RULE_COLORS: { name: string; hex: string }[] = [
  { name: 'Red', hex: SIGNAL_SOLIDS['danger-hi'] },
  { name: 'Orange', hex: SIGNAL_SOLIDS.warn },
  { name: 'Amber', hex: SIGNAL_SOLIDS.caution },
  { name: 'Green', hex: SIGNAL_SOLIDS.ok },
  { name: 'Violet', hex: SIGNAL_SOLIDS.violet },
  { name: 'Blue', hex: HUE_PAIRS.sky[1] },
];

export interface ColorCardProps {
  colorRule: BoardConfig['colorRule'];
  rules: readonly CardColorRuleEntry[];
  editable: boolean;
  catalog: LqlFieldCatalog;
  values: Readonly<Record<string, readonly string[]>>;
  onPreset: (rule: BoardConfig['colorRule']) => void;
  onRules: (rules: CardColorRuleEntry[]) => void;
}

/**
 * The mock's "Card color" card: the stripe presets as radios, then the
 * colour rules the mock does not draw, each an LQL condition and a colour.
 */
export function ColorCard(props: ColorCardProps) {
  const { rules, editable, onRules } = props;
  const set = (index: number, patch: Partial<CardColorRuleEntry>) =>
    onRules(rules.map((rule, at) => (at === index ? { ...rule, ...patch } : rule)));
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-br2 px-3.5 py-2.5 text-12h font-semibold">Card color</div>
      <div role="radiogroup" aria-label="Card color" className="flex flex-col gap-2 px-3.5 py-2.5">
        {PRESETS.map(([id, description]) => {
          const selected = props.colorRule === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={!editable}
              onClick={editable ? () => props.onPreset(id) : undefined}
              className={cx(
                'flex items-center gap-2.25 border-0 bg-transparent p-0 text-left font-sans text-13 text-tx',
                editable ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span
                aria-hidden
                className={cx(
                  'size-3.5 rounded-full border-[1.5px] bg-sf',
                  selected ? 'border-ac-fill shadow-radio' : 'border-br-ctl',
                )}
              />
              <span className="font-medium">{COLOR_RULE_LABELS[id]}</span>
              <span className="text-12 text-tx5">{description}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 border-t border-br2 px-3.5 py-2.5">
        <div className="flex items-center text-12h font-semibold">
          Color rules
          {editable && (
            <button
              type="button"
              onClick={() => onRules([...rules, { query: '', color: RULE_COLORS[0]?.hex ?? '' }])}
              className="ml-auto cursor-pointer border-0 bg-transparent p-0 font-sans text-12h font-medium text-ac hover:text-ac-d"
            >
              + Add rule
            </button>
          )}
        </div>
        {rules.map((rule, index) => (
          <div key={index} className="flex items-start gap-2">
            <span role="radiogroup" aria-label="Rule color" className="flex gap-1 pt-1.5">
              {RULE_COLORS.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  role="radio"
                  aria-checked={rule.color === color.hex}
                  aria-label={color.name}
                  aria-disabled={!editable}
                  onClick={editable ? () => set(index, { color: color.hex }) : undefined}
                  style={{ backgroundColor: color.hex }}
                  className={cx(
                    'size-3.5 rounded-full border-0 p-0',
                    rule.color === color.hex && 'shadow-ring-ac',
                    editable ? 'cursor-pointer' : 'cursor-default',
                  )}
                />
              ))}
            </span>
            <LqlInput
              aria-label={`Color rule ${index + 1} condition`}
              className="flex-1"
              value={rule.query}
              readOnly={!editable}
              catalog={props.catalog}
              values={props.values}
              placeholder="type = Bug"
              onChange={(query) => set(index, { query })}
            />
            {editable && (
              <button
                type="button"
                aria-label={`Remove color rule ${index + 1}`}
                onClick={() => onRules(rules.filter((_, at) => at !== index))}
                className="flex cursor-pointer border-0 bg-transparent pt-1.5 text-tx6 hover:text-tx2"
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        ))}
        <span className="text-12 leading-note text-tx4">
          {rules.length === 0
            ? 'Paint a card when it matches a query, such as type = Bug.'
            : 'The first matching rule paints the stripe; other cards follow the preset above.'}
        </span>
      </div>
    </Card>
  );
}
