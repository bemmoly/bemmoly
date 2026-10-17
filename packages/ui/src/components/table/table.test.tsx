import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { Table } from './table.tsx';

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = Array.from({ length: 1000 }, (_, index) => ({
  id: `app-${index}`,
  name: `Application ${index}`,
}));
const columns = [
  { key: 'name', header: 'Application', width: 'minmax(0,1fr)', render: (row: Row) => row.name },
];

describe('Table, virtual', () => {
  beforeAll(() => {
    // jsdom lays nothing out; the body only needs the observer's methods to exist.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it('draws only the rows in view and still counts them all', async () => {
    const pane = document.createElement('div');
    Object.defineProperty(pane, 'clientHeight', { value: 440 });
    Object.defineProperty(pane, 'offsetHeight', { value: 440 });
    pane.getBoundingClientRect = () => ({ height: 440, width: 800 }) as DOMRect;
    document.body.append(pane);
    const onEndReached = vi.fn();
    const { container } = render(
      <Table
        label="Applications"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={() => undefined}
        virtual={{ getScrollElement: () => pane, rowHeight: 44 }}
        onEndReached={onEndReached}
        total={1140}
      />,
      { container: pane.appendChild(document.createElement('div')) },
    );
    const drawn = screen.getAllByRole('row').length - 1;
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThan(60);
    expect(screen.getByRole('table').getAttribute('aria-rowcount')).toBe('1141');
    expect(onEndReached).not.toHaveBeenCalled();
    await expectAccessible(container);
    pane.remove();
  });

  it('asks for the next page when the end of a short list is in view', () => {
    const onEndReached = vi.fn();
    const pane = document.createElement('div');
    Object.defineProperty(pane, 'clientHeight', { value: 440 });
    Object.defineProperty(pane, 'offsetHeight', { value: 440 });
    pane.getBoundingClientRect = () => ({ height: 440, width: 800 }) as DOMRect;
    document.body.append(pane);
    render(
      <Table
        label="Applications"
        columns={columns}
        rows={rows.slice(0, 5)}
        rowKey={(row) => row.id}
        virtual={{ getScrollElement: () => pane, rowHeight: 44 }}
        onEndReached={onEndReached}
      />,
      { container: pane.appendChild(document.createElement('div')) },
    );
    expect(onEndReached).toHaveBeenCalled();
    pane.remove();
  });
});
