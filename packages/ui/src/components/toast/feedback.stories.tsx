import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from '../button/icon-button.tsx';
import { Button } from '../button/button.tsx';
import { Tooltip } from '../tooltip/tooltip.tsx';
import { ToastProvider, useToast } from './toaster.tsx';

const meta = { title: 'Foundations/Feedback', component: Tooltip } satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Hover one, then slide along: the next tooltip opens at once. Focus opens them too. */
export const TooltipsWithShortcuts: Story = {
  args: { label: 'New issue', children: <button type="button">New</button> },
  render: () => (
    <div className="flex gap-1 pt-12">
      <Tooltip label="New issue" keys="C">
        <IconButton label="New issue" icon="plus" />
      </Tooltip>
      <Tooltip label="Search" keys="/">
        <IconButton label="Search" icon="search" />
      </Tooltip>
      <Tooltip label="Command palette" keys="Mod+K">
        <IconButton label="Command palette" icon="command" />
      </Tooltip>
      <Tooltip label="Toggle sidebar" keys="[">
        <IconButton label="Toggle sidebar" icon="sidebar" />
      </Tooltip>
    </div>
  ),
};

function UndoDemo() {
  const toast = useToast();
  return (
    <div className="flex gap-2">
      <Button
        onClick={() =>
          toast.undo({ title: 'PLT-219 deleted', onUndo: () => toast.show({ title: 'Restored' }) })
        }
      >
        Delete issue
      </Button>
      <Button
        onClick={() =>
          toast.show({
            tone: 'danger',
            title: "Couldn't save the title",
            body: 'The server did not answer.',
            action: { label: 'Retry', onClick: () => {} },
          })
        }
      >
        Fail a save
      </Button>
    </div>
  );
}

/** Undo for six seconds; hover or focus holds it, Escape closes the focused one. */
export const UndoToast: Story = {
  args: { label: 'Undo', children: <button type="button">Undo</button> },
  render: () => (
    <ToastProvider>
      <UndoDemo />
    </ToastProvider>
  ),
};
