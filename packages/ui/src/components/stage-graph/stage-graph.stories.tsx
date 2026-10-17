import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { RunGlyphState } from '../run-glyph/run-glyph.tsx';
import { RUN_STATE_WORDS } from '../run-glyph/states.ts';
import { StageGraph, type StageGraphProps, type StageGraphStage } from './stage-graph.tsx';

const node = (id: string, name: string, state: RunGlyphState, detail: string) => ({
  id,
  name,
  state,
  detail,
});

/** The failing pull request run from the product design. */
const FAILING: StageGraphStage[] = [
  { index: 0, nodes: [node('affected', 'Affected services', 'passed', '2 of 41 changed')] },
  {
    index: 1,
    nodes: [
      node('build-refunds', 'Build refunds-api', 'passed', '1m 48s'),
      node('build-ledger', 'Build ledger-api', 'passed', '2m 02s'),
    ],
  },
  {
    index: 2,
    nodes: [
      node('unit-1', 'Unit 1 of 3', 'passed', '2m 41s'),
      node('unit-2', 'Unit 2 of 3', 'failed', '2 failed · 2m 55s'),
      node('unit-3', 'Unit 3 of 3', 'passed', '2m 37s'),
      node('lint', 'Lint and types', 'passed', '58s'),
    ],
  },
  {
    index: 3,
    nodes: [
      node('scan', 'Security scan', 'passed', '0 high · 3 low'),
      node('contract', 'Contract tests', 'passed', '1m 12s'),
    ],
  },
  { index: 4, nodes: [node('preview', 'Preview deploy', 'skipped', 'needs every test')] },
];

const FAILING_EDGES = [
  { from: 'affected', to: 'build-refunds' },
  { from: 'affected', to: 'build-ledger' },
  ...['unit-1', 'unit-2', 'unit-3', 'lint'].flatMap((to) => [
    { from: 'build-refunds', to },
    { from: 'build-ledger', to },
  ]),
  ...['unit-1', 'unit-2', 'unit-3', 'lint'].flatMap((from) => [
    { from, to: 'scan' },
    { from, to: 'contract' },
  ]),
  { from: 'scan', to: 'preview' },
  { from: 'contract', to: 'preview' },
];

const stateLabel = (state: RunGlyphState) => RUN_STATE_WORDS[state];

function Selectable(props: Omit<StageGraphProps, 'onSelect' | 'ariaLabel' | 'stateLabel'>) {
  const [selected, setSelected] = useState(props.selectedId ?? null);
  return (
    <StageGraph
      {...props}
      ariaLabel="Stages of run 8,812"
      stateLabel={stateLabel}
      selectedId={selected}
      onSelect={setSelected}
    />
  );
}

const meta = {
  title: 'Pipelines/StageGraph',
  component: Selectable,
  args: { stages: FAILING, edges: FAILING_EDGES, selectedId: 'unit-2' },
  decorators: [(Story) => <div className="rounded-card bg-sunken p-4">{Story()}</div>],
} satisfies Meta<typeof Selectable>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Opens on the failure: the failed shard is selected with a red ring. */
export const FailedShard: Story = {};

export const FailedShardDark: Story = { globals: { mode: 'dark' } };

/** No edges from the server: one connector between neighbouring columns. */
export const SimpleConnectors: Story = { args: { edges: undefined, selectedId: 'scan' } };

/** A running build with the running job selected: an accent ring and accent edges. */
export const Running: Story = {
  args: {
    selectedId: 'unit-2',
    stages: FAILING.map((stage) => ({
      ...stage,
      nodes: stage.nodes.map((n) =>
        stage.index >= 2 ? { ...n, state: stage.index === 2 ? 'running' : 'queued' } : n,
      ),
    })),
  },
};

const SHARDS = 48;

/** A big matrix: 48 shards fanning out and back in, sixty nodes in all. */
export const ManyShards: Story = {
  args: {
    selectedId: 'shard-17',
    stages: [
      { index: 0, nodes: [node('detect', 'Affected services', 'passed', '12 of 41 changed')] },
      {
        index: 1,
        nodes: Array.from({ length: 6 }, (_, i) =>
          node(`build-${i}`, `Build service ${i + 1}`, 'passed', '1m 5s'),
        ),
      },
      {
        index: 2,
        nodes: Array.from({ length: SHARDS }, (_, i) =>
          node(
            `shard-${i}`,
            `Unit ${i + 1} of ${SHARDS}`,
            i === 17 ? 'failed' : i % 9 === 0 ? 'running' : 'passed',
            '2m 10s',
          ),
        ),
      },
      { index: 3, nodes: [node('report', 'Test report', 'queued', 'needs every shard')] },
      { index: 4, nodes: [node('deploy', 'Preview deploy', 'skipped', 'needs every test')] },
    ],
    edges: [
      ...Array.from({ length: 6 }, (_, i) => ({ from: 'detect', to: `build-${i}` })),
      ...Array.from({ length: SHARDS }, (_, i) => ({ from: `build-${i % 6}`, to: `shard-${i}` })),
      ...Array.from({ length: SHARDS }, (_, i) => ({ from: `shard-${i}`, to: 'report' })),
      { from: 'report', to: 'deploy' },
    ],
  },
};
