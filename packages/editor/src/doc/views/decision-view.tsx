import { Menu, MenuItem } from '@bemmoly/ui';
import { cx } from '../../cx.ts';
import { DECISION_LABELS, DECISION_STATES, type DecisionState } from '../../schema/nodes/values.ts';
import type { NodeViewProps, ViewSpec } from '../portals.ts';
import { DECISION_BOX, DECISION_INK, NODE_BODY, NODE_HEADER, STATE_PILL } from '../styles.ts';

export const decisionState = (value: unknown): DecisionState =>
  DECISION_STATES.includes(value as DecisionState) ? (value as DecisionState) : 'proposed';

export const decisionClass = (state: DecisionState) => cx(DECISION_BOX, DECISION_INK[state].border);

const today = () => new Date().toISOString().slice(0, 10);

/** "DECISION", the state as a pill (a menu while editing) and the day it was made. */
export function DecisionHeader({
  state,
  decidedOn,
  onChange,
}: {
  state: DecisionState;
  decidedOn: string | null;
  onChange?: ((state: DecisionState, decidedOn: string | null) => void) | undefined;
}) {
  const pill = cx(STATE_PILL, DECISION_INK[state].pill);
  return (
    <div className={cx(NODE_HEADER, 'text-tx5')}>
      <span className="text-11 font-medium tracking-caps uppercase">Decision</span>
      {onChange ? (
        <Menu
          widthClassName="w-44"
          trigger={(props) => (
            <button
              {...props}
              type="button"
              aria-label={`${DECISION_LABELS[state]}, change state`}
              className={cx(pill, 'cursor-pointer border-0')}
            >
              {DECISION_LABELS[state]}
            </button>
          )}
        >
          {DECISION_STATES.map((option) => (
            <MenuItem
              key={option}
              hint={option === state ? '✓' : undefined}
              onSelect={() =>
                onChange(option, option === 'decided' ? (decidedOn ?? today()) : decidedOn)
              }
            >
              {DECISION_LABELS[option]}
            </MenuItem>
          ))}
        </Menu>
      ) : (
        <span className={pill}>{DECISION_LABELS[state]}</span>
      )}
      {decidedOn && <span className="font-normal text-tx5">{decidedOn}</span>}
    </div>
  );
}

function DecisionChrome({ node, editor, updateAttributes }: NodeViewProps) {
  const decidedOn = typeof node.attrs['decidedOn'] === 'string' ? node.attrs['decidedOn'] : null;
  return (
    <DecisionHeader
      state={decisionState(node.attrs['state'])}
      decidedOn={decidedOn}
      onChange={
        editor.isEditable ? (state, day) => updateAttributes({ state, decidedOn: day }) : undefined
      }
    />
  );
}

export const decisionView: ViewSpec = {
  tag: 'div',
  className: (node) => decisionClass(decisionState(node.attrs['state'])),
  attrs: (node) => ({ 'data-type': 'decision', 'data-state': decisionState(node.attrs['state']) }),
  content: { tag: 'div', className: NODE_BODY },
  Component: DecisionChrome,
};
