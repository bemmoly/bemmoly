import type { Meta, StoryObj } from '@storybook/react-vite';
import { RUN_GLYPH_STATES, RunGlyph, type RunGlyphSize } from './run-glyph.tsx';
import { RUN_STATE_WORDS } from './states.ts';

const meta = {
  title: 'Pipelines/RunGlyph',
  component: RunGlyph,
  args: { state: 'running' },
} satisfies Meta<typeof RunGlyph>;

export default meta;

type Story = StoryObj<typeof meta>;

const SIZES: RunGlyphSize[] = [12, 14, 16, 18];

/** Every state at every size, with its word: the vocabulary runs, jobs and stations share. */
function Sheet() {
  return (
    <div className="flex flex-col gap-2 text-13 text-tx">
      {RUN_GLYPH_STATES.map((state) => (
        <div key={state} className="flex items-center gap-3">
          {SIZES.map((size) => (
            <RunGlyph key={size} state={state} size={size} />
          ))}
          <span className="font-medium">{RUN_STATE_WORDS[state]}</span>
        </div>
      ))}
    </div>
  );
}

export const AllStates: Story = { render: () => <Sheet /> };

export const AllStatesDark: Story = { render: () => <Sheet />, globals: { mode: 'dark' } };

export const Labelled: Story = { args: { state: 'failed', size: 18, label: 'Failed' } };

/** A long list, as Runs draws it: the spinning arcs must stay cheap. */
export const ManyRunning: Story = {
  render: () => (
    <div className="grid grid-cols-12 gap-2">
      {Array.from({ length: 96 }, (_, index) => (
        <RunGlyph
          key={index}
          state={RUN_GLYPH_STATES[index % RUN_GLYPH_STATES.length] ?? 'queued'}
        />
      ))}
    </div>
  ),
};
