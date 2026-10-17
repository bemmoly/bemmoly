import { useLayoutEffect, useState, type RefObject } from 'react';

export interface GraphEdge {
  from: string;
  to: string;
}

export interface DrawnEdge extends GraphEdge {
  d: string;
}

interface Box {
  left: number;
  right: number;
  mid: number;
}

/** A node's box inside the graph's own coordinates; offsets avoid a layout read per scroll. */
function boxOf(element: HTMLElement, root: HTMLElement): Box {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== root) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { left, right: left + element.offsetWidth, mid: top + element.offsetHeight / 2 };
}

/** A curve from the source's end edge to the target's start edge, whichever way the page reads. */
function curve(source: Box, target: Box): string {
  const forward = source.left <= target.left;
  const x1 = forward ? source.right : source.left;
  const x2 = forward ? target.left : target.right;
  const bend = (x2 - x1) / 2;
  return `M${x1} ${source.mid} C${x1 + bend} ${source.mid} ${x2 - bend} ${target.mid} ${x2} ${target.mid}`;
}

/**
 * Measures the nodes and draws the edges between them. It runs on layout and whenever the graph
 * changes size, never per frame, so a matrix of sixty nodes costs one pass.
 */
export function useEdges(
  root: RefObject<HTMLElement | null>,
  nodes: RefObject<Map<string, HTMLElement>>,
  edges: readonly GraphEdge[] | undefined,
  layoutKey: string,
): { edges: DrawnEdge[]; width: number; height: number } {
  const [drawn, setDrawn] = useState<{ edges: DrawnEdge[]; width: number; height: number }>({
    edges: [],
    height: 0,
    width: 0,
  });
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || !edges) return undefined;
    const measure = () => {
      const next: DrawnEdge[] = [];
      for (const edge of edges) {
        const source = nodes.current.get(edge.from);
        const target = nodes.current.get(edge.to);
        if (!source || !target) continue;
        next.push({ ...edge, d: curve(boxOf(source, element), boxOf(target, element)) });
      }
      setDrawn({ edges: next, width: element.scrollWidth, height: element.scrollHeight });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [root, nodes, edges, layoutKey]);
  return drawn;
}
