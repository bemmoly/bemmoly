import { Menu, MenuItem } from '@bemmoly/ui';
import { cx } from '../../cx.ts';
import {
  CALLOUT_LABELS,
  CALLOUT_VARIANTS,
  type CalloutVariant,
} from '../../schema/nodes/values.ts';
import type { NodeViewProps, ViewSpec } from '../portals.ts';
import { CALLOUT_INK, calloutClass, NODE_BODY, NODE_HEADER } from '../styles.ts';

export const calloutVariant = (value: unknown): CalloutVariant =>
  CALLOUT_VARIANTS.includes(value as CalloutVariant) ? (value as CalloutVariant) : 'info';

const Dot = ({ variant }: { variant: CalloutVariant }) => (
  <span data-dot className={CALLOUT_INK[variant].dot} />
);

/** The callout's header: its dot and label, which opens the style menu while editing. */
export function CalloutHeader({
  variant,
  onChange,
}: {
  variant: CalloutVariant;
  onChange?: ((variant: CalloutVariant) => void) | undefined;
}) {
  const label = CALLOUT_LABELS[variant];
  return (
    <div className={cx(NODE_HEADER, CALLOUT_INK[variant].label)}>
      <Dot variant={variant} />
      {onChange ? (
        <Menu
          widthClassName="w-44"
          trigger={(props) => (
            <button
              {...props}
              type="button"
              aria-label={`${label} callout, change style`}
              className="cursor-pointer bg-transparent p-0 font-semibold text-inherit hover:underline"
            >
              {label}
            </button>
          )}
        >
          {CALLOUT_VARIANTS.map((option) => (
            <MenuItem
              key={option}
              icon={<span className={cx('size-1.75 rounded-full', CALLOUT_INK[option].dot)} />}
              checked={option === variant}
              onSelect={() => onChange(option)}
            >
              {CALLOUT_LABELS[option]}
            </MenuItem>
          ))}
        </Menu>
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}

function CalloutChrome({ node, editor, updateAttributes }: NodeViewProps) {
  return (
    <CalloutHeader
      variant={calloutVariant(node.attrs['variant'])}
      onChange={editor.isEditable ? (next) => updateAttributes({ variant: next }) : undefined}
    />
  );
}

export const calloutView: ViewSpec = {
  tag: 'div',
  className: (node) => calloutClass(calloutVariant(node.attrs['variant'])),
  attrs: (node) => ({
    'data-type': 'callout',
    'data-variant': calloutVariant(node.attrs['variant']),
  }),
  content: { tag: 'div', className: NODE_BODY },
  Component: CalloutChrome,
};
