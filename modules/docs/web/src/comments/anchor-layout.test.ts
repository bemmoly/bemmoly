import { describe, expect, it } from 'vitest';
import { stackTops } from './anchor-layout.ts';

const item = (id: string, y: number, height = 50) => ({ id, y, height });

describe('placing threads level with their text', () => {
  it('keeps each card on its anchor line while they do not overlap', () => {
    expect(stackTops([item('a', 0), item('b', 100), item('c', 300)], 10)).toEqual([0, 100, 300]);
  });

  it('stacks a card below the one before when they would overlap', () => {
    expect(stackTops([item('a', 0), item('b', 20), item('c', 40)], 10)).toEqual([0, 60, 120]);
  });

  it('keeps the focused card beside its text and pushes the earlier ones up', () => {
    expect(stackTops([item('a', 100), item('b', 120), item('c', 140)], 10, 'b')).toEqual([
      60, 120, 180,
    ]);
  });

  it('never pushes a card above the top', () => {
    expect(stackTops([item('a', 10), item('b', 20)], 10, 'b')[0]).toBe(0);
  });
});
