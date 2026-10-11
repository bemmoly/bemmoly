import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from '../../lib/cx.ts';
import { useCanvasViewport, type CanvasRegion } from './canvas-viewport.ts';

export interface WorkflowCanvasProps extends HTMLAttributes<HTMLDivElement> {
  /** Names the canvas, e.g. "Software workflow". */
  label: string;
  /** The canvas units the edge paths are drawn in; the mock uses 1000 x 560. */
  width?: number;
  height?: number;
  /** TransitionEdges, drawn under the nodes. */
  edges?: ReactNode;
  /** StatusNodes and TransitionLabels, positioned in percentages. */
  children: ReactNode;
  /** The region, in canvas units, the canvas opens scrolled to; usually the box around the nodes. */
  frame?: CanvasRegion;
  /** The drawn surface's box, which an editor measures to turn pointer pixels into canvas units. */
  ref?: Ref<HTMLDivElement>;
}

const MARKERS = [
  ['workflow-arrow', 'fill-tx-3'],
  ['workflow-arrow-ac', 'fill-acc'],
  ['workflow-arrow-danger', 'fill-red'],
] as const;

/**
 * The workflow surface: an 8px card with a 20px dot grid in br, the edges in one SVG that
 * stretches to the box, the nodes and labels absolutely placed over it. The card takes the width
 * it is given; the surface keeps the mock's 1000 x 560 at least and scrolls inside the card, by
 * wheel, trackpad or a drag on empty canvas.
 */
export function WorkflowCanvas({
  label,
  width = 1000,
  height = 560,
  edges,
  children,
  frame,
  ref,
  className,
  style,
  ...rest
}: WorkflowCanvasProps) {
  const { viewportRef, surfaceRef, pannable, panning, onPointerDown } = useCanvasViewport({
    width,
    height,
    frame,
    surfaceRef: ref,
  });

  return (
    <div
      role="group"
      aria-label={label}
      ref={viewportRef}
      data-canvas-viewport=""
      onPointerDown={onPointerDown}
      className={cx(
        'relative min-w-0 overflow-auto overscroll-x-contain rounded-card border border-line bg-card',
        panning ? 'cursor-grabbing select-none' : pannable && 'cursor-grab',
        className,
      )}
      style={style}
      {...rest}
    >
      <div
        ref={surfaceRef}
        style={{
          backgroundImage: 'radial-gradient(var(--line) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
        className="relative h-139.5 w-full min-w-249.5"
      >
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <defs>
            {MARKERS.map(([id, fill]) => (
              <marker
                key={id}
                id={id}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path d="M0 0L10 5L0 10z" className={fill} />
              </marker>
            ))}
          </defs>
          {edges}
        </svg>
        {children}
      </div>
    </div>
  );
}
