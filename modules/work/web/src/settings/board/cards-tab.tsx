import { CARD_FIELDS, type CardField } from '@bemmoly/module-work/shared';
import { Card, Checkbox } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { NO_BOARD_PERMISSION } from '../../hooks/settings-access.ts';
import { cx } from '../cx.ts';
import { useDragList } from '../drag.ts';
import { checkLql } from '../model/lql.ts';
import { CARD_FIELD_KINDS, CARD_FIELD_LABELS } from '../model/labels.ts';
import { EditFooter, SectionHeading } from '../section.tsx';
import { CardPreview } from './card-preview.tsx';
import { ColorCard } from './color-card.tsx';
import { footerProps, type BoardTabProps } from './tab-props.ts';

/** Shown fields in their order, then the hidden ones in the mock's order. */
export function fieldOrder(shown: readonly CardField[]): CardField[] {
  return [...shown, ...CARD_FIELDS.filter((field) => !shown.includes(field))];
}

/** Turns a field on or off, keeping its place in the full order. */
export function toggleField(shown: readonly CardField[], field: CardField): CardField[] {
  if (shown.includes(field)) return shown.filter((item) => item !== field);
  return fieldOrder(shown).filter((item) => item === field || shown.includes(item));
}

export interface CardsTabProps extends BoardTabProps {
  values: Readonly<Record<string, readonly string[]>>;
}

/** The Cards tab: which fields show and in what order, the preview and the card colour. */
export function CardsTab(props: CardsTabProps) {
  const { settings, mode, access } = props;
  const config = settings.value?.config;
  const editable = mode === 'edit' && access.configureBoard;
  const order = fieldOrder(config?.cardFields ?? []);
  const drag = useDragList({
    disabled: !editable,
    onMove: (from, to) =>
      settings.updateConfig((current) => {
        const all = fieldOrder(current.cardFields);
        const [moved] = all.splice(from, 1);
        if (moved) all.splice(to, 0, moved);
        return {
          ...current,
          cardFields: all.filter((field) => current.cardFields.includes(field)),
        };
      }),
  });
  if (!config) return null;
  const firstRule = config.colorRules.find((rule) => !checkLql(rule.query, settings.catalog));

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Card layout"
        description="Choose which fields appear on cards. Up to 3 extra fields show in the footer; the rest are visible on hover and in the detail panel."
        mode={mode}
        locked={access.configureBoard ? undefined : NO_BOARD_PERMISSION}
        onEdit={props.onEdit}
      />
      <div className="grid grid-cols-2 items-start gap-4">
        <Card className="flex flex-col px-4 py-1.5">
          {order.map((field, index) => (
            <div
              key={field}
              {...drag.item(index)}
              className={cx(
                'flex items-center gap-2.5 border-b border-br-row py-2.25 last:border-b-0',
                drag.over === index && 'shadow-tab',
              )}
            >
              <span
                {...drag.handle(index, order.length)}
                {...(editable
                  ? {
                      tabIndex: 0,
                      role: 'button',
                      'aria-label': `Move ${CARD_FIELD_LABELS[field]}`,
                    }
                  : {})}
                className={cx('flex text-tx6', editable && 'cursor-grab')}
              >
                <Icon name="drag" size={14} />
              </span>
              <Checkbox
                aria-label={CARD_FIELD_LABELS[field]}
                checked={config.cardFields.includes(field)}
                readOnly={!editable}
                onChange={() =>
                  editable &&
                  settings.updateConfig((current) => ({
                    ...current,
                    cardFields: toggleField(current.cardFields, field),
                  }))
                }
              />
              <span className="flex-1 font-medium">{CARD_FIELD_LABELS[field]}</span>
              <span className="text-12 text-tx5">{CARD_FIELD_KINDS[field]}</span>
            </div>
          ))}
        </Card>
        <div className="flex flex-col gap-2.5">
          <div className="text-12 font-medium tracking-caps text-tx5 uppercase">Preview</div>
          <CardPreview
            fields={config.cardFields}
            colorRule={config.colorRule}
            ruleColor={firstRule?.color}
          />
          <ColorCard
            colorRule={config.colorRule}
            rules={config.colorRules}
            editable={editable}
            catalog={settings.catalog}
            values={props.values}
            onPreset={(colorRule) =>
              settings.updateConfig((current) => ({ ...current, colorRule }))
            }
            onRules={(colorRules) =>
              settings.updateConfig((current) => ({ ...current, colorRules }))
            }
          />
        </div>
      </div>
      {mode === 'edit' && <EditFooter {...footerProps(props, settings.dirty.cards)} />}
    </div>
  );
}
