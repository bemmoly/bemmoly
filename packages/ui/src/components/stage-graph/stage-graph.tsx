import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '../../lib/cx.ts';
import { RunGlyph, type RunGlyphState } from '../run-glyph/run-glyph.tsx';
import { nextNode } from './navigate.ts';
import { useEdges } from './use-edges.ts';

export interface StageGraphNode {
  id: string;
  /** "Unit 2 of 3", "Build refunds-api". */
  name: string;
  state: RunGlyphState;
  /** "2m 41s", "2 failed · 2m 55s", "needs every test". */
  detail: string;
}

export interface StageGraphStage {
  index: number;
  nodes: readonly StageGraphNode[];
}

export interface StageGraphProps {
  stages: readonly StageGraphStage[];
  /**
   * Node ids; drawn as curves from the source's end edge to the target's start edge. Absent:
   * one connector between neighbouring columns.
   */
  edges?: readonly { from: string; to: string }[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Names the graph: "Stages of run 8,812". */
  ariaLabel: string;
  /** The state in words, in the person's language ("Failed"). */
  stateLabel: (state: RunGlyphState) => string;
  className?: string;
}

/** A stage with more jobs than this wraps into columns of six, so a big matrix stays wide, not tall. */
const STACK = 6;

const touchesNode = (edge: { from: string; to: string }, id: string | null) =>
  id !== null && (edge.from === id || edge.to === id);

/** The stroke of an edge: accent into and out of the selected node, red when that node failed. */
function strokeOf(touchesSelected: boolean, selectedFailed: boolean): string {
  if (!touchesSelected) return 'var(--line)';
  return selectedFailed ? 'var(--red)' : 'var(--acc)';
}

/**
 * A run's stages left to right, jobs stacked in each, with fan-out and fan-in drawn between
 * them. The selected node carries a ring (red when it failed); skipped work is dimmed. One tab
 * stop: arrows move between stages and within one, J and K walk the nodes in reading order,
 * Enter selects. Wide graphs scroll sideways inside themselves, never the page.
 */
export function StageGraph({
  stages,
  edges,
  selectedId = null,
  onSelect,
  ariaLabel,
  stateLabel,
  className,
}: StageGraphProps) {
  const root = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const columns = useMemo(
    () => stages.map((stage) => stage.nodes.map((node) => node.id)),
    [stages],
  );
  const layoutKey = columns.map((ids) => ids.join(',')).join('|');
  const drawn = useEdges(root, nodeRefs, edges, layoutKey);
  const flat = columns.flat();
  const [focused, setFocused] = useState<string | null>(null);
  const active = [focused, selectedId, flat[0]].find((id) => id && flat.includes(id)) ?? null;
  const selected = stages.flatMap((stage) => stage.nodes).find((node) => node.id === selectedId);
  const selectedFailed = selected?.state === 'failed';

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!active || event.altKey || event.metaKey || event.ctrlKey) return;
    const rtl = root.current ? getComputedStyle(root.current).direction === 'rtl' : false;
    const next = nextNode(columns, active, event.key, rtl);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    setFocused(next);
    nodeRefs.current.get(next)?.focus();
  };

  return (
    <div className={cx('overflow-x-auto', className)}>
      <div
        ref={root}
        role="group"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className="relative flex w-max min-w-full items-center px-1 py-1"
      >
        {edges && (
          <svg
            aria-hidden
            data-part="edges"
            className="pointer-events-none absolute start-0 top-0"
            width={drawn.width}
            height={drawn.height}
          >
            {/* Edges touching the selected node are drawn last, over the others they cross. */}
            {[...drawn.edges]
              .sort(
                (a, b) => Number(touchesNode(a, selectedId)) - Number(touchesNode(b, selectedId)),
              )
              .map((edge) => {
                const touches = touchesNode(edge, selectedId);
                return (
                  <path
                    key={`${edge.from}>${edge.to}`}
                    d={edge.d}
                    fill="none"
                    stroke={strokeOf(touches, selectedFailed)}
                    strokeWidth={touches ? 2 : 1.5}
                  />
                );
              })}
          </svg>
        )}
        {stages.map((stage, position) => (
          <div key={stage.index} className="flex items-center self-stretch">
            {position > 0 && (
              <span aria-hidden className="relative w-10 shrink-0 self-stretch">
                {!edges && (
                  <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-line" />
                )}
              </span>
            )}
            <div
              className={cx(
                'relative gap-2',
                stage.nodes.length > STACK
                  ? 'grid grid-flow-col grid-rows-6 content-center'
                  : 'flex flex-col justify-center',
              )}
            >
              {stage.nodes.map((node) => {
                const isSelected = node.id === selectedId;
                return (
                  <button
                    key={node.id}
                    type="button"
                    ref={(element) => {
                      if (element) nodeRefs.current.set(node.id, element);
                      else nodeRefs.current.delete(node.id);
                    }}
                    tabIndex={node.id === active ? 0 : -1}
                    aria-pressed={isSelected}
                    aria-label={`${node.name}, ${stateLabel(node.state)}, ${node.detail}`}
                    data-state={node.state}
                    onFocus={() => setFocused(node.id)}
                    onClick={() => onSelect?.(node.id)}
                    className={cx(
                      'flex w-42 flex-col gap-0.5 rounded-card bg-card px-3 py-2 text-start shadow-e1 hover:shadow-e1h focus-ring',
                      isSelected &&
                        (node.state === 'failed' ? 'ring-2 ring-red' : 'ring-2 ring-acc'),
                      node.state === 'skipped' && !isSelected && 'opacity-60',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-13 font-medium text-tx">
                      <RunGlyph state={node.state} size={16} />
                      <span className="truncate">{node.name}</span>
                    </span>
                    <span className="truncate ps-6 text-12 text-tx-3">{node.detail}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
