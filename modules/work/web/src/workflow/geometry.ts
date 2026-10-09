import { CANVAS, NODE, type DraftTransition, type EditorDraft } from './draft-model.ts';

/** One transition as the canvas draws it: the path, and where its name sits, in canvas units. */
export interface EdgeShape {
  id: string;
  d: string;
  labelX: number;
  labelY: number;
  any: boolean;
}

type Point = { x: number; y: number };

const ALIGNED = 4;

/** A cubic's point at t = 0.5, where the label goes on a curve. */
const midCubic = (a: Point, c1: Point, c2: Point, b: Point): Point => ({
  x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8,
  y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8,
});

const cubic = (a: Point, c1: Point, c2: Point, b: Point) =>
  `M${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;

/**
 * The Workflow mock's geometry, generalised: neighbours on a row are joined
 * straight from side to side with the name above, and the way back loops
 * under them; a column is joined straight down or up; anything else leaves
 * the side facing its target and arrives on the target's facing edge.
 */
function between(a: Point, b: Point, paired: boolean): Omit<EdgeShape, 'id' | 'any'> {
  const { halfWidth: w, halfHeight: h } = NODE;
  if (Math.abs(a.y - b.y) <= ALIGNED) {
    if (b.x < a.x) {
      const c1 = { x: a.x, y: a.y + 70 };
      const c2 = { x: b.x, y: b.y + 70 };
      return {
        d: cubic({ x: a.x, y: a.y + h }, c1, c2, { x: b.x, y: b.y + h }),
        labelX: (a.x + b.x) / 2,
        labelY: a.y + 60,
      };
    }
    const sign = b.x > a.x ? 1 : -1;
    return {
      d: `M${a.x + sign * w} ${a.y} L ${b.x - sign * w} ${b.y}`,
      labelX: (a.x + b.x) / 2,
      labelY: a.y - 16,
    };
  }
  const down = b.y > a.y ? 1 : -1;
  if (Math.abs(a.x - b.x) <= ALIGNED) {
    const shift = paired ? (down > 0 ? 12 : -12) : 0;
    return {
      d: `M${a.x + shift} ${a.y + down * h} L ${b.x + shift} ${b.y - down * h}`,
      labelX: a.x + shift + (down > 0 ? 60 : -60),
      labelY: (a.y + b.y) / 2,
    };
  }
  const side = b.x > a.x ? 1 : -1;
  const start = { x: a.x + side * w, y: a.y };
  const end = { x: b.x, y: b.y - down * h };
  const c1 = { x: start.x + side * Math.abs(end.x - start.x) * 0.5, y: start.y };
  const c2 = { x: end.x, y: end.y - down * Math.abs(end.y - start.y) * 0.5 };
  const mid = midCubic(start, c1, c2, end);
  return { d: cubic(start, c1, c2, end), labelX: mid.x, labelY: mid.y };
}

/** The mock's "Any → Close" arrow: a dashed hook into the target's upper left. */
function fromAny(b: Point): Omit<EdgeShape, 'id' | 'any'> {
  return {
    d: `M${b.x - 140} ${b.y - 60} Q ${b.x - 110} ${b.y - 60} ${b.x - 78} ${b.y - 10}`,
    labelX: Math.max(50, b.x - 160),
    labelY: Math.max(12, b.y - 62),
  };
}

const point = (draft: EditorDraft, id: string | null): Point | undefined => {
  const status = draft.statuses.find((candidate) => candidate.id === id);
  return status ? { x: status.x ?? CANVAS.width / 2, y: status.y ?? CANVAS.height / 2 } : undefined;
};

/** Every drawable transition; one pointing at a removed status is left for Validate to name. */
export function edgeShapes(draft: EditorDraft): EdgeShape[] {
  const shapes: EdgeShape[] = [];
  const pairKey = (t: DraftTransition) => `${t.fromStatusId}>${t.toStatusId}`;
  const keys = new Set(draft.transitions.map(pairKey));
  for (const transition of draft.transitions) {
    const to = point(draft, transition.toStatusId);
    if (!to) continue;
    if (transition.fromStatusId === null) {
      shapes.push({ id: transition.id, any: true, ...fromAny(to) });
      continue;
    }
    const from = point(draft, transition.fromStatusId);
    if (!from || transition.fromStatusId === transition.toStatusId) continue;
    const paired = keys.has(`${transition.toStatusId}>${transition.fromStatusId}`);
    shapes.push({ id: transition.id, any: false, ...between(from, to, paired) });
  }
  return shapes;
}

/** Canvas units to the percentages the nodes and labels are placed with. */
export const pctX = (x: number) => `${(x / CANVAS.width) * 100}%`;
export const pctY = (y: number) => `${(y / CANVAS.height) * 100}%`;
