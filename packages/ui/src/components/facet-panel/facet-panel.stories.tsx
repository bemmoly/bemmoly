import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { EntityTile } from '../entity-tile/entity-tile.tsx';
import { FacetPanel, type FacetGroup } from './facet-panel.tsx';

const DOMAINS: [string, number, 'epic-1' | 'epic-2' | 'epic-3' | 'epic-4' | 'epic-5'][] = [
  ['Commerce', 212, 'epic-1'],
  ['Logistics', 187, 'epic-2'],
  ['Platform', 168, 'epic-3'],
  ['Data', 141, 'epic-4'],
  ['Finance', 102, 'epic-5'],
];
const TEAMS = Array.from({ length: 54 }, (_, index) => ({
  value: `team-${index}`,
  label:
    ['Payments', 'Checkout web', 'Pricing', 'Cart', 'Search', 'Identity'][index % 6] +
    (index > 5 ? ` ${index}` : ''),
  count: Math.max(0, 23 - index),
}));

function Demo() {
  const [selected, setSelected] = useState<Record<string, string[]>>({ domain: ['Commerce'] });
  const groups: FacetGroup[] = [
    {
      key: 'domain',
      label: 'Domain',
      selected: selected['domain'] ?? [],
      options: DOMAINS.map(([name, count, hue]) => ({
        value: name,
        label: name,
        count,
        icon: <EntityTile name={name} hue={hue} size={16} />,
      })),
    },
    {
      key: 'team',
      label: 'Owner team',
      selected: selected['team'] ?? [],
      options: TEAMS,
      limit: 5,
    },
    {
      key: 'tier',
      label: 'Tier',
      selected: selected['tier'] ?? [],
      options: [
        { value: '0', label: 'Tier 0', count: 41 },
        { value: '1', label: 'Tier 1', count: 188 },
        { value: '2', label: 'Tier 2', count: 911 },
      ],
    },
  ];
  return (
    <div className="w-55">
      <FacetPanel
        ariaLabel="Filters"
        groups={groups}
        showAllLabel={(count) => `Show all ${count}`}
        showFewerLabel="Show fewer"
        formatCount={(count) => count.toLocaleString('en')}
        onToggle={(group, value) =>
          setSelected((current) => {
            const list = current[group] ?? [];
            return {
              ...current,
              [group]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
            };
          })
        }
      />
    </div>
  );
}

const meta = { title: 'Pipelines/FacetPanel', render: () => <Demo /> } satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Catalog: Story = {};

export const CatalogDark: Story = { globals: { mode: 'dark' } };
