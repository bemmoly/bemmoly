import type { Meta, StoryObj } from '@storybook/react-vite';
import { HUES } from '../../tokens/names.ts';
import { Label } from '../label/label.tsx';
import { Avatar, UnassignedAvatar } from './avatar.tsx';

const meta = { title: 'Foundations/People and labels', component: Avatar } satisfies Meta<
  typeof Avatar
>;

export default meta;

type Story = StoryObj<typeof meta>;

const NAMES = ['Rohan S.', 'Priya N.', 'Aisha K.', 'Jonas M.', 'Lena T.', 'Maya K.', 'Dev P.'];

/** Solid avatars with white initials at 42% of the size; unassigned is a dashed ring. */
export const Avatars: Story = {
  args: { name: 'Rohan S.' },
  render: () => (
    <div className="flex flex-col gap-3">
      {[24, 18].map((size) => (
        <div key={size} className="flex items-center gap-1.5">
          <Avatar name="Rohan S." hue="accent" size={size} />
          {HUES.map((hue, i) => (
            <Avatar key={hue} name={NAMES[i + 1] ?? hue} hue={hue} size={size} />
          ))}
          <UnassignedAvatar size={size} />
        </div>
      ))}
    </div>
  ),
};

/** Outlined pills with the label's own colour as a dot. */
export const Labels: Story = {
  args: { name: 'Rohan S.' },
  render: () => (
    <div className="flex flex-wrap gap-1.5">
      <Label name="api" color="#2b8fc9" />
      <Label name="auth" color="#5b6cd9" />
      <Label name="security" color="#c2536a" />
      <Label name="infra" color="#23988a" />
      <Label name="no colour" />
      <Label name="removable" color="#d08a1a" onRemove={() => {}} />
    </div>
  ),
};
