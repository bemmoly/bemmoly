import type { z } from 'zod';
import type { StatusCategory, workflowDraftSchema } from '../../../shared/index.ts';

/*
 * The draft as the editor holds it, and the pure edits on it. Every edit
 * returns a new draft, so the hook can keep the last one, save it debounced,
 * and compare it with what was saved. Coordinates are the centre of a node in
 * the canvas's 1000 x 560 units, as the draft schema stores them.
 */

export type EditorDraft = z.output<typeof workflowDraftSchema>;
export type DraftStatus = EditorDraft['statuses'][number];
export type DraftTransition = EditorDraft['transitions'][number];

export type Selection = { kind: 'status'; id: string } | { kind: 'transition'; id: string } | null;

export const CANVAS = { width: 1000, height: 560 } as const;
/** Half a node in canvas units: 150px wide, about 56px tall, at the mock's 1000px canvas. */
export const NODE = { halfWidth: 75, halfHeight: 28 } as const;

let sequence = 0;

/**
 * Ids for statuses and transitions made in the editor. They carry no dashes,
 * so the server and the mock both read them as new rows and publish gives
 * them real ids.
 */
export function clientId(prefix: 's' | 't'): string {
  sequence += 1;
  return `${prefix}${Date.now().toString(36)}${sequence.toString(36)}`;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Keeps a whole node inside the canvas. */
export function clampPoint(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(clamp(x, NODE.halfWidth, CANVAS.width - NODE.halfWidth)),
    y: Math.round(clamp(y, NODE.halfHeight, CANVAS.height - NODE.halfHeight)),
  };
}

/** The mock's grid: columns 190 apart from x 110, rows from y 120. */
function slot(index: number): { x: number; y: number } {
  return { x: 110 + (index % 5) * 190, y: 120 + Math.floor(index / 5) * 180 };
}

/** A published workflow carries no coordinates; lay those statuses out by position. */
export function withLayout(draft: EditorDraft): EditorDraft {
  if (draft.statuses.every((status) => status.x !== undefined && status.y !== undefined))
    return draft;
  const order = [...draft.statuses].sort((a, b) => a.position - b.position);
  return {
    ...draft,
    statuses: draft.statuses.map((status) => {
      if (status.x !== undefined && status.y !== undefined) return status;
      const { x, y } = slot(order.indexOf(status));
      return { ...status, x: clampPoint(x, y).x, y: clampPoint(x, y).y };
    }),
  };
}

function freeSlot(draft: EditorDraft): { x: number; y: number } {
  for (let index = 0; index < 15; index += 1) {
    const point = clampPoint(slot(index).x, slot(index).y);
    const taken = draft.statuses.some(
      (status) =>
        Math.abs((status.x ?? -999) - point.x) < NODE.halfWidth * 2 &&
        Math.abs((status.y ?? -999) - point.y) < NODE.halfHeight * 3,
    );
    if (!taken) return point;
  }
  return { x: CANVAS.width / 2, y: CANVAS.height / 2 };
}

/** "New status", then "New status 2", so a fresh draft never fails on a duplicate name. */
function freshName(draft: EditorDraft, base: string): string {
  const names = new Set(draft.statuses.map((status) => status.name.trim().toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let n = 2;
  while (names.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}

export function addStatus(
  draft: EditorDraft,
  category: StatusCategory = 'todo',
): { draft: EditorDraft; id: string } {
  const id = clientId('s');
  const position = Math.max(-1, ...draft.statuses.map((status) => status.position)) + 1;
  const status: DraftStatus = {
    id,
    name: freshName(draft, 'New status'),
    category,
    position,
    allowedRoleIds: [],
    ...freeSlot(draft),
  };
  return { draft: { ...draft, statuses: [...draft.statuses, status] }, id };
}

export type StatusPatch = Partial<Pick<DraftStatus, 'name' | 'category' | 'color'>>;

export function updateStatus(draft: EditorDraft, id: string, patch: StatusPatch): EditorDraft {
  return {
    ...draft,
    statuses: draft.statuses.map((status) => {
      if (status.id !== id) return status;
      const next = { ...status, ...patch };
      if (patch.color === undefined && 'color' in patch) delete next.color;
      return next;
    }),
  };
}

export function moveStatus(draft: EditorDraft, id: string, x: number, y: number): EditorDraft {
  const point = clampPoint(x, y);
  return {
    ...draft,
    statuses: draft.statuses.map((status) =>
      status.id === id ? { ...status, x: point.x, y: point.y } : status,
    ),
  };
}

/** Removing a status takes every transition into or out of it along. */
export function removeStatus(draft: EditorDraft, id: string): EditorDraft {
  return {
    statuses: draft.statuses.filter((status) => status.id !== id),
    transitions: draft.transitions.filter(
      (transition) => transition.fromStatusId !== id && transition.toStatusId !== id,
    ),
  };
}

export const statusById = (draft: EditorDraft, id: string | null) =>
  draft.statuses.find((status) => status.id === id);

export const transitionById = (draft: EditorDraft, id: string | null) =>
  draft.transitions.find((transition) => transition.id === id);

/** The draft as it would be sent, for comparing with what the server last stored. */
export const draftKey = (draft: EditorDraft): string => JSON.stringify(draft);
