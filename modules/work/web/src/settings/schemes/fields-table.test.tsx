import type { Field } from '@bemmoly/module-work/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FieldsTable } from './fields-table.tsx';

afterEach(cleanup);

const at = '2026-10-01T09:00:00.000Z';

const storyPoints: Field = {
  id: '018f0000-0000-7000-8000-000000000a01',
  projectId: null,
  originId: null,
  key: 'story_points',
  name: 'Story points',
  kind: 'number',
  options: [],
  filterable: true,
  aiFill: true,
  createdAt: at,
  updatedAt: at,
};

function renderTable(aiEnabled: boolean) {
  return render(
    <FieldsTable
      rows={[storyPoints]}
      loading={false}
      editable={false}
      aiEnabled={aiEnabled}
      onRename={vi.fn()}
    />,
  );
}

describe('FieldsTable', () => {
  it('marks a field AI fills, in lilac, while AI is on', () => {
    renderTable(true);
    expect(screen.getByText('AI fills').className).toContain('text-ai-600');
  });

  it('draws no AI mark while AI is off, and no lilac at all', () => {
    const { container } = renderTable(false);
    expect(screen.getByText('Story points')).toBeTruthy();
    expect(screen.queryByText('AI fills')).toBeNull();
    expect(container.innerHTML).not.toMatch(/-ai(-\d+)?\b/);
  });
});
