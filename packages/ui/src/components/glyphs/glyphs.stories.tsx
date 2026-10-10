import type { Meta, StoryObj } from '@storybook/react-vite';
import { TYPE_COLORS } from '../../tokens/semantic.ts';
import {
  ISSUE_TYPES,
  PRIORITIES,
  PriorityGlyph,
  StatusGlyph,
  TYPE_COLOR_CHOICES,
  TYPE_ICON_CHOICES,
  TypeGlyph,
  type IssueType,
  type Priority,
  type StatusStage,
} from './glyphs.tsx';

const meta = { title: 'Foundations/Glyphs', component: TypeGlyph } satisfies Meta<typeof TypeGlyph>;

export default meta;

type Story = StoryObj<typeof meta>;

const STAGES: StatusStage[] = ['backlog', 'todo', 'progress', 'review', 'qa', 'done', 'wont'];

/** The review's foundations sheet: types at 20, 16 and 14px, priority and status. */
export const Foundations: Story = {
  args: { type: 'story' },
  render: () => (
    <div className="grid grid-cols-3 gap-8 text-13 text-tx">
      <div className="flex flex-col gap-2">
        {(Object.keys(ISSUE_TYPES) as IssueType[]).map((key) => (
          <div key={key} className="flex items-center gap-2.5">
            <TypeGlyph type={key} size={20} />
            <TypeGlyph type={key} size={16} />
            <TypeGlyph type={key} />
            <span className="font-medium">{ISSUE_TYPES[key].name}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {(Object.keys(PRIORITIES) as Priority[]).map((priority) => (
          <PriorityGlyph key={priority} priority={priority} showLabel />
        ))}
        <PriorityGlyph priority={null} showLabel />
      </div>
      <div className="flex flex-col gap-2">
        {STAGES.map((stage) => (
          <span key={stage} className="flex items-center gap-2">
            <StatusGlyph stage={stage} size={16} />
            <span className="font-medium">
              {stage === 'wont' ? "Won't do" : stage[0]?.toUpperCase() + stage.slice(1)}
            </span>
          </span>
        ))}
      </div>
    </div>
  ),
};

/** What a custom type can be: any icon of the set on any colour of the type family. */
export const CustomTypes: Story = {
  args: { type: 'story' },
  render: () => (
    <div className="flex max-w-120 flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {TYPE_ICON_CHOICES.map((icon, i) => (
          <TypeGlyph
            key={icon}
            size={20}
            type={{
              key: `custom_${icon}`,
              name: icon,
              icon,
              color: TYPE_COLORS[TYPE_COLOR_CHOICES[i % TYPE_COLOR_CHOICES.length] ?? 'type-task'],
            }}
          />
        ))}
      </div>
      <p className="m-0 text-12 text-tx-3">
        Colours: {TYPE_COLOR_CHOICES.map((token) => token.replace('type-', '')).join(', ')}. An icon
        stored by the first release as a character falls back to its level's look.
      </p>
    </div>
  ),
};
