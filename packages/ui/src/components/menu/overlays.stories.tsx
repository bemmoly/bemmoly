import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../button/button.tsx';
import { IconButton } from '../button/icon-button.tsx';
import { Modal } from '../modal/modal.tsx';
import { Tabs } from '../tabs/tabs.tsx';
import { Toast } from '../toast/toast.tsx';
import { ToastProvider, useToast } from '../toast/toaster.tsx';
import { Tooltip } from '../tooltip/tooltip.tsx';
import { Menu } from './menu.tsx';
import { MenuGroup, MenuItem } from './menu-item.tsx';

const meta = {
  title: 'Components/Menu, Modal, Tabs, Toast, Tooltip',
  component: Menu,
} satisfies Meta<typeof Menu>;

export default meta;

type Story = StoryObj<typeof meta>;
const noop = () => {};

export const SlashMenu: Story = {
  args: { trigger: () => null, children: null },
  parameters: {
    mock: [
      {
        file: 'Bemmoly Doc Editor.dc.html',
        x: 352,
        y: 1256,
        w: 336,
        h: 354,
        viewport: { width: 1440, height: 1700 },
        note: 'slash menu',
      },
    ],
  },
  render: () => (
    <div className="h-90">
      <Menu defaultOpen trigger={(props) => <Button {...props}>Insert</Button>}>
        <MenuGroup label="AI">
          <MenuItem onSelect={noop}>Continue writing</MenuItem>
          <MenuItem onSelect={noop}>Summarize open questions from comments</MenuItem>
          <MenuItem onSelect={noop}>Create issues from this section</MenuItem>
          <MenuItem onSelect={noop}>Check consistency with linked issues</MenuItem>
        </MenuGroup>
        <MenuGroup label="Blocks" separated>
          <MenuItem onSelect={noop}>Issue table from filter</MenuItem>
          <MenuItem onSelect={noop}>Decision</MenuItem>
          <MenuItem onSelect={noop}>Code block</MenuItem>
        </MenuGroup>
      </Menu>
    </div>
  ),
};

export const ConfirmModal: Story = {
  args: { trigger: () => null, children: null },
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Delete project
        </Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Delete Platform Core?"
          description="This moves 182 issues and 2 doc spaces to trash. You can restore them for 30 days."
          footer={
            <>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => setOpen(false)}>
                Delete project
              </Button>
            </>
          }
        >
          Type the project key, PLT, to confirm.
        </Modal>
      </>
    );
  },
};

export const UnderlineTabs: Story = {
  args: { trigger: () => null, children: null },
  parameters: {
    mock: [
      { file: 'Bemmoly Board Settings.dc.html', x: 264, y: 266, w: 660, h: 50, note: 'md' },
      { file: 'Bemmoly Home.dc.html', x: 121, y: 340, w: 724, h: 40, note: 'sm, card header' },
    ],
  },
  render: function Render() {
    const [tab, setTab] = useState('columns');
    const [home, setHome] = useState('assigned');
    return (
      <div className="flex w-180 flex-col gap-6">
        <Tabs
          aria-label="Board settings"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'columns', label: 'Columns' },
            { value: 'lanes', label: 'Swimlanes' },
            { value: 'cards', label: 'Cards' },
            { value: 'est', label: 'Method and estimation' },
            { value: 'perms', label: 'Permissions', badge: '2 locked' },
          ]}
        />
        <div className="rounded-card border border-br bg-sf">
          <Tabs
            aria-label="My work"
            size="sm"
            bordered={false}
            className="border-b border-br2 px-4"
            value={home}
            onChange={setHome}
            end={<span className="text-12h font-medium text-ac">View all</span>}
            items={[
              { value: 'assigned', label: 'Assigned to me', count: 6 },
              { value: 'review', label: 'Waiting on me', count: 3 },
              { value: 'mentioned', label: 'Mentioned', count: 2 },
              { value: 'created', label: 'Created by me', count: 3 },
            ]}
          />
        </div>
      </div>
    );
  },
};

function ToastDemo() {
  const { show } = useToast();
  return (
    <div className="flex gap-2">
      <Button
        onClick={() =>
          show({ tone: 'ok', title: 'Theme saved', body: 'Everyone in Acme Labs sees it now.' })
        }
      >
        Save
      </Button>
      <Button
        onClick={() =>
          show({
            tone: 'danger',
            title: 'The provider returned a rate limit',
            body: "I'll retry in 30 seconds. Nothing else is affected.",
            duration: 0,
          })
        }
      >
        Fail
      </Button>
    </div>
  );
}

export const Toasts: Story = {
  args: { trigger: () => null, children: null },
  render: () => (
    <ToastProvider>
      <div className="flex flex-col gap-3">
        <Toast
          tone="info"
          title="Import running"
          body="I'll email you when PLT is in, about 12 minutes."
          onDismiss={noop}
        />
        <Toast
          tone="ai"
          title="I drafted a status update"
          body="Review it before it posts."
          action={{ label: 'Review draft', onClick: noop }}
          onDismiss={noop}
        />
        <ToastDemo />
      </div>
    </ToastProvider>
  ),
};

export const Tooltips: Story = {
  args: { trigger: () => null, children: null },
  render: () => (
    <div className="flex gap-3 pt-10">
      <Tooltip content="Open full page">
        <IconButton label="Open full page" icon="expand" size="xs" />
      </Tooltip>
      <Tooltip content="Time in column" side="bottom">
        <Button size="xs">3d</Button>
      </Tooltip>
    </div>
  ),
};
