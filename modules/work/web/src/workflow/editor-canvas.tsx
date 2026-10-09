import {
  revealInCanvas,
  RuleChip,
  StatusNode,
  StatusNodeHandle,
  TransitionEdge,
  TransitionLabel,
  WorkflowCanvas,
  WorkflowLegend,
} from '@bemmoly/ui';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useCanvasPointer } from '../hooks/workflow-canvas-pointer.ts';
import { NUDGE, type WorkflowEditorModel } from '../hooks/workflow-editor.ts';
import type { DraftTransition, EditorDraft, Selection } from './draft-model.ts';
import { contentBounds, edgeShapes, pctX, pctY } from './geometry.ts';
import { canvasCategory, colorClassOf } from './status-colors.ts';

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export interface EditorCanvasProps {
  label: string;
  draft: EditorDraft;
  selection: Selection;
  counts: Record<string, number> | undefined;
  invalidStatuses: ReadonlySet<string>;
  invalidTransitions: ReadonlySet<string>;
  actions: WorkflowEditorModel['actions'];
}

function RuleChips({ transition }: { transition: DraftTransition }) {
  const { conditions, validators, postActions } = transition.rules;
  return (
    <>
      {conditions.length > 0 && <RuleChip kind="condition" count={conditions.length} />}
      {validators.length > 0 && <RuleChip kind="validator" count={validators.length} />}
      {postActions.length > 0 && <RuleChip kind="post" count={postActions.length} />}
    </>
  );
}

/**
 * The Workflow mock's canvas, editable: nodes drag, the selected node's
 * handle draws a transition, labels select their transition, and the
 * keyboard reaches all of it (Tab, arrows to nudge, Delete, Escape).
 */
export function EditorCanvas({
  label,
  draft,
  selection,
  counts,
  invalidStatuses,
  invalidTransitions,
  actions,
}: EditorCanvasProps) {
  const canvas = useRef<HTMLDivElement>(null);
  const pointer = useCanvasPointer({
    canvas,
    onSelect: (id) => actions.select({ kind: 'status', id }),
    onMove: actions.moveStatus,
    onConnect: actions.connect,
  });
  /** The box the canvas opens on; later edits never move the view on their own. */
  const [frame] = useState(() => contentBounds(draft));
  const shapes = edgeShapes(draft);
  const byId = new Map(draft.transitions.map((transition) => [transition.id, transition]));
  const selectedStatus = selection?.kind === 'status' ? selection.id : null;
  const selectedTransition = selection?.kind === 'transition' ? selection.id : null;

  // A selection made from the side panel can name a status or transition scrolled out of view.
  const selectedKind = selection?.kind;
  const selectedId = selection?.id;
  useEffect(() => {
    if (!selectedKind || !selectedId) return;
    const element = canvas.current?.querySelector(`[data-${selectedKind}-id="${selectedId}"]`);
    if (element) revealInCanvas(element);
  }, [selectedKind, selectedId]);

  const onKey = (event: KeyboardEvent, target: NonNullable<Selection>) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      actions.select(target);
      actions.requestDelete(target);
      return;
    }
    if (event.key === 'Escape') {
      actions.select(null);
      return;
    }
    const arrow = ARROWS[event.key];
    if (!arrow || target.kind !== 'status') return;
    event.preventDefault();
    const step = event.shiftKey ? NUDGE.fine : NUDGE.step;
    actions.select(target);
    actions.nudgeStatus(target.id, arrow[0] * step, arrow[1] * step);
    // The view follows a node nudged past its edge, once the move has drawn.
    const node = event.currentTarget;
    requestAnimationFrame(() => revealInCanvas(node));
  };

  const highlightOf = (transition: DraftTransition | undefined) =>
    transition !== undefined &&
    (transition.id === selectedTransition ||
      (selectedStatus !== null && transition.fromStatusId === selectedStatus));

  const selected = draft.statuses.find((status) => status.id === selectedStatus);
  return (
    <WorkflowCanvas
      ref={canvas}
      label={label}
      {...(frame ? { frame } : {})}
      edges={
        <>
          {shapes.map((shape) => (
            <TransitionEdge
              key={shape.id}
              d={shape.d}
              any={shape.any}
              highlighted={highlightOf(byId.get(shape.id))}
              invalid={invalidTransitions.has(shape.id)}
            />
          ))}
          {pointer.connector && (
            <TransitionEdge
              highlighted
              d={`M${pointer.connector.from.x} ${pointer.connector.from.y} L ${pointer.connector.to.x} ${pointer.connector.to.y}`}
            />
          )}
        </>
      }
    >
      {draft.statuses.map((status) => {
        const target = { kind: 'status', id: status.id } as const;
        return (
          <StatusNode
            key={status.id}
            data-status-id={status.id}
            name={status.name}
            category={canvasCategory(status.category)}
            colorClassName={colorClassOf(status.color)}
            {...(counts ? { count: counts[status.id] ?? 0 } : {})}
            x={pctX(status.x ?? 0)}
            y={pctY(status.y ?? 0)}
            selected={status.id === selectedStatus}
            invalid={invalidStatuses.has(status.id)}
            className="touch-none select-none"
            onPointerDown={(event) => pointer.startNodeDrag(event, status)}
            onClick={() => {
              if (!pointer.consumeDrag()) actions.select(target);
            }}
            onKeyDown={(event) => onKey(event, target)}
          />
        );
      })}
      {selected && (
        <StatusNodeHandle
          x={pctX(selected.x ?? 0)}
          y={pctY(selected.y ?? 0)}
          className="touch-none"
          onPointerDown={(event) => pointer.startConnect(event, selected)}
        />
      )}
      {shapes.map((shape) => {
        const transition = byId.get(shape.id);
        if (!transition) return null;
        const target = { kind: 'transition', id: transition.id } as const;
        return (
          <TransitionLabel
            key={shape.id}
            data-transition-id={transition.id}
            interactive
            x={pctX(shape.labelX)}
            y={pctY(shape.labelY)}
            highlighted={highlightOf(transition)}
            selected={transition.id === selectedTransition}
            invalid={invalidTransitions.has(transition.id)}
            onClick={() => actions.select(target)}
            onKeyDown={(event) => onKey(event, target)}
          >
            {shape.any ? `Any → ${transition.name}` : transition.name}
            {/* The selected edge alone carries its chips: at rest the labels stay the
                mock's width, which already fills the 40px between neighbours. */}
            {transition.id === selectedTransition && <RuleChips transition={transition} />}
          </TransitionLabel>
        );
      })}
      <WorkflowLegend />
    </WorkflowCanvas>
  );
}
