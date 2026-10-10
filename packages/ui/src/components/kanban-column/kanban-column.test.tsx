import { describe, expect, it } from 'vitest';
import { kanbanGridStyle } from './kanban-column.tsx';

describe('kanbanGridStyle', () => {
  it('shares the width equally between the columns', () => {
    expect(kanbanGridStyle(5).gridTemplateColumns).toBe('repeat(5,minmax(0,1fr))');
    expect(kanbanGridStyle(5, 5).gridTemplateColumns).toBe('repeat(5,minmax(0,1fr))');
  });

  it('keeps hidden columns out without stretching the ones left', () => {
    expect(kanbanGridStyle(2, 5).gridTemplateColumns).toBe(
      'repeat(2,minmax(0,calc((100% - calc(var(--spacing) * 2.5) * 4) / 5)))',
    );
  });
});
