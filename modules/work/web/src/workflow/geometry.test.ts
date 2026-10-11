import { describe, expect, it } from 'vitest';
import { workflowDraftSchema } from '../../../shared/index.ts';
import { contentBounds } from './geometry.ts';

const status = (id: string, x: number, y: number, position: number) => ({
  id,
  name: id,
  category: 'todo' as const,
  position,
  x,
  y,
});

describe('contentBounds', () => {
  it('boxes every node by its full width and height', () => {
    const draft = workflowDraftSchema.parse({
      statuses: [status('a', 110, 120, 0), status('b', 870, 300, 1)],
      transitions: [],
    });
    expect(contentBounds(draft)).toEqual({ left: 35, top: 92, right: 945, bottom: 328 });
  });

  it('reaches left for an "Any →" label and stays inside the canvas', () => {
    const draft = workflowDraftSchema.parse({
      statuses: [status('a', 300, 420, 0), status('b', 120, 40, 1)],
      transitions: [{ id: 't', fromStatusId: null, toStatusId: 'a', name: 'Close', position: 0 }],
    });
    expect(contentBounds(draft)).toEqual({ left: 45, top: 12, right: 375, bottom: 448 });
  });
});
