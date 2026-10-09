import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { RuleChip, RuleRow } from './rule-chip.tsx';
import { StatusNode, StatusNodeHandle, StatusPill, type WorkflowCategory } from './status-node.tsx';
import { TransitionEdge, TransitionLabel, TransitionRow, WorkflowLegend } from './edges.tsx';
import { WorkflowCanvas } from './workflow-canvas.tsx';

const meta = { title: 'Components/WorkflowCanvas', component: StatusNode } satisfies Meta<
  typeof StatusNode
>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The Workflow mock's `N` table: centre, colour, category and count per status. */
const NODES: Record<string, [number, number, WorkflowCategory, number, string?]> = {
  Backlog: [110, 120, 'todo', 42],
  Selected: [300, 120, 'todo', 9],
  'In progress': [490, 120, 'progress', 4],
  'Code review': [680, 120, 'progress', 2, 'bg-violet'],
  Testing: [680, 300, 'progress', 2, 'bg-caution'],
  Done: [870, 300, 'done', 9],
  "Won't do": [300, 420, 'done', 3],
};

const EDGES: [string, string, string][] = [
  ['Backlog', 'Selected', 'Select for sprint'],
  ['Selected', 'In progress', 'Start work'],
  ['In progress', 'Code review', 'Open PR'],
  ['Code review', 'Testing', 'Approve'],
  ['Code review', 'In progress', 'Request changes'],
  ['Testing', 'Done', 'Pass QA'],
  ['Testing', 'In progress', 'Fail QA'],
];

const px = (v: number) => `${(v / 1000) * 100}%`;
const py = (v: number) => `${(v / 560) * 100}%`;
const at = (name: string): [number, number] => {
  const node = NODES[name];
  return node ? [node[0], node[1]] : [0, 0];
};

/** The mock's edge geometry: straight between neighbours, a loop back, or a curve across rows. */
function edge(a: string, b: string): { d: string; lx: number; ly: number } {
  const [ax, ay] = at(a);
  const [bx, by] = at(b);
  if (ay === by) {
    if (bx < ax) {
      return {
        d: `M${ax} ${ay + 28} C ${ax} ${ay + 70}, ${bx} ${by + 70}, ${bx} ${by + 28}`,
        lx: (ax + bx) / 2,
        ly: ay + 60,
      };
    }
    return { d: `M${ax + 75} ${ay} L ${bx - 75} ${by}`, lx: (ax + bx) / 2, ly: ay - 16 };
  }
  if (ax === bx)
    return { d: `M${ax} ${ay + 28} L ${bx} ${by - 28}`, lx: ax + 60, ly: (ay + by) / 2 };
  return {
    d: `M${ax - 75} ${ay} C ${ax - 150} ${ay}, ${bx + 20} ${by - 120}, ${bx + 30} ${by - 28}`,
    lx: (ax + bx) / 2 - 40,
    ly: (ay + by) / 2 - 20,
  };
}

/** The Software workflow with "Code review" selected, as the mock opens. */
export const Canvas: Story = {
  args: { name: 'Code review', category: 'progress', count: 2, x: '50%', y: '50%' },
  parameters: {
    layout: 'fullscreen',
    mock: [
      {
        file: 'Bemmoly Workflow.dc.html',
        x: 264,
        y: 112,
        w: 1000,
        h: 560,
        note: 'canvas (Workflow view)',
      },
    ],
  },
  render: function Render() {
    const [selected, setSelected] = useState('Code review');
    const [wx, wy] = at("Won't do");
    return (
      <div className="w-262 bg-bg p-6">
        <WorkflowCanvas
          label="Software workflow"
          edges={
            <>
              {EDGES.map(([a, b]) => (
                <TransitionEdge key={`${a}-${b}`} d={edge(a, b).d} highlighted={selected === a} />
              ))}
              <TransitionEdge
                any
                d={`M${wx - 140} ${wy - 60} Q ${wx - 110} ${wy - 60} ${wx - 78} ${wy - 10}`}
              />
            </>
          }
        >
          {Object.entries(NODES).map(([name, [x, y, category, count, color]]) => (
            <StatusNode
              key={name}
              name={name}
              category={category}
              colorClassName={color}
              count={count}
              x={px(x)}
              y={py(y)}
              selected={selected === name}
              onClick={() => setSelected(name)}
            />
          ))}
          {EDGES.map(([a, b, label]) => {
            const { lx, ly } = edge(a, b);
            return (
              <TransitionLabel key={label} x={px(lx)} y={py(ly)} highlighted={selected === a}>
                {label}
              </TransitionLabel>
            );
          })}
          <TransitionLabel x={px(wx - 160)} y={py(wy - 62)}>
            Any → Close
          </TransitionLabel>
          <WorkflowLegend />
        </WorkflowCanvas>
      </div>
    );
  },
};

/** The editor's states the mock does not draw: a problem, a selected edge with its rule chips, the connector. */
export const EditingStates: Story = {
  args: { name: 'Done', category: 'done', x: '50%', y: '50%' },
  render: () => (
    <div className="w-262 bg-bg p-6">
      <WorkflowCanvas
        label="Editing states"
        edges={
          <>
            <TransitionEdge d="M375 120 L 545 120" highlighted />
            <TransitionEdge d="M300 148 L 300 392" invalid />
          </>
        }
      >
        <StatusNode name="Testing" category="progress" count={2} x="30%" y={py(120)} selected />
        <StatusNodeHandle x="30%" y={py(120)} />
        <StatusNode name="Done" category="done" x="62%" y={py(120)} />
        <StatusNode name="Won't do" category="done" x="30%" y={py(420)} invalid />
        <TransitionLabel x="46%" y={py(104)} interactive selected>
          Pass QA
          <RuleChip kind="condition" count={1} />
          <RuleChip kind="post" count={1} />
        </TransitionLabel>
        <TransitionLabel x="36%" y={py(270)} interactive invalid>
          Give up
        </TransitionLabel>
      </WorkflowCanvas>
    </div>
  ),
};

/** The side panel pieces: transitions out, the three rule kinds, and the Board Settings status pills. */
export const PanelPieces: Story = {
  args: { name: 'Code review', category: 'progress', count: 2, x: '50%', y: '50%' },
  parameters: {
    mock: [
      {
        file: 'Bemmoly Workflow.dc.html',
        x: 1100,
        y: 112,
        w: 340,
        h: 420,
        note: 'panel (Workflow view)',
      },
    ],
  },
  render: () => (
    <div className="flex w-85 flex-col gap-4 bg-sf p-4 text-12h">
      <div className="flex flex-col gap-2">
        <span className="font-semibold">Transitions out</span>
        <TransitionRow onMore={() => {}}>Testing (Approve)</TransitionRow>
        <TransitionRow onMore={() => {}}>In progress (Request changes)</TransitionRow>
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-semibold">Rules when entering</span>
        <RuleRow kind="condition">A pull request must be linked</RuleRow>
        <RuleRow kind="validator">Reviewer field is not empty</RuleRow>
        <RuleRow kind="post">Notify reviewers; start review timer</RuleRow>
      </div>
      <div className="flex flex-col gap-1.5">
        <StatusPill block name="Backlog" category="todo" count={42} />
        <StatusPill
          block
          name="Code review"
          category="progress"
          colorClassName="bg-violet"
          count={2}
        />
        <span className="flex gap-1.5">
          <StatusPill name="Won't do" category="todo" />
          <StatusPill name="Duplicate" category="todo" />
        </span>
      </div>
    </div>
  ),
};
