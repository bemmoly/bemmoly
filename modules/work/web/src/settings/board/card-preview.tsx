import type { BoardConfig, CardField } from '@bemmoly/module-work/shared';
import { Avatar, Badge, cardStripe, KeyChip, PriorityGlyph, Tag, TypeGlyph } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { cx } from '../cx.ts';

/** The stripe a colour preset paints on the mock's sample card: a medium-priority story in an epic. */
export const sampleStripe = (rule: BoardConfig['colorRule']) =>
  cardStripe(rule, { priority: 'medium', type: 'story', epicClassName: 'border-l-ac' });

/**
 * The Cards tab preview: the mock's sample card with only the chosen fields.
 * Built from the card's parts rather than KanbanCard, which always shows the
 * type, key and priority. A matching colour rule's colour is data, so inline.
 */
export function CardPreview({
  fields,
  colorRule,
  ruleColor,
}: {
  fields: readonly CardField[];
  colorRule: BoardConfig['colorRule'];
  /** The colour of the first rule, painted over the preset as the board would. */
  ruleColor?: string | undefined;
}) {
  const on = (field: CardField) => fields.includes(field);
  const stripe = ruleColor ? 'border-l-[3px]' : sampleStripe(colorRule);
  return (
    <div
      aria-label="Card preview"
      style={ruleColor ? { borderLeftColor: ruleColor } : undefined}
      className={cx(
        'flex w-70 flex-col gap-2 rounded-control border border-br bg-sf px-2.5 pt-2.5 pb-2 text-13 text-tx shadow-card',
        stripe && cx('border-l-[3px]', stripe),
      )}
    >
      {on('blocked') && (
        <span className="flex items-center gap-1.5 self-start rounded-xs bg-warn-bg px-1.75 py-0.75 text-11 font-medium text-warn-fg">
          <span aria-hidden className="size-1.75 rounded-full bg-warn" />
          Blocked by PLT-204
        </span>
      )}
      <div className="leading-card">Session cleanup background job</div>
      {on('labels') && (
        <div className="flex gap-1">
          <Tag>infra</Tag>
          <Tag>auth</Tag>
        </div>
      )}
      <div className="flex items-center gap-1.5 pt-0.5">
        {on('type') && <TypeGlyph type="story" />}
        {on('key') && <KeyChip issueKey="PLT-211" />}
        {on('priority') && <PriorityGlyph priority="medium" />}
        {on('docs') && (
          <span className="flex items-center gap-0.75 text-11 text-ac">
            <Icon name="doc" size={11} />
            RFC
          </span>
        )}
        {on('due') && <span className="text-11 text-warn-fg">Oct 6</span>}
        {on('subtasks') && (
          <span className="flex items-center gap-0.75 font-mono text-11 text-tx4">
            <Icon name="subtasks" size={11} />
            2/5
          </span>
        )}
        {on('created') && <span className="text-11 text-tx5">Sep 28</span>}
        <span className="ml-auto flex items-center gap-1.5">
          {on('estimate') && (
            <Badge variant="count" className="min-w-5 justify-center">
              3
            </Badge>
          )}
          {on('reporter') && <Avatar name="Priya N." hue="green" />}
          {on('assignee') && <Avatar name="Jonas M." initials="JM" hue="violet" />}
        </span>
      </div>
    </div>
  );
}
