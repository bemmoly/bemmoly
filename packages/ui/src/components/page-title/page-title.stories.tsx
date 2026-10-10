import type { Meta, StoryObj } from '@storybook/react-vite';
import { Breadcrumbs } from '../breadcrumbs/breadcrumbs.tsx';
import { Button } from '../button/button.tsx';
import { IconButton } from '../button/icon-button.tsx';
import { TypeGlyph } from '../glyphs/glyphs.tsx';
import { KeyChip } from '../key-chip/key-chip.tsx';
import { PageTitle } from './page-title.tsx';

const meta = { title: 'Components/PageTitle', component: PageTitle } satisfies Meta<
  typeof PageTitle
>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Board: Story = {
  args: { title: 'PLT Sprint 14' },
  parameters: {
    mock: [{ file: 'Bemmoly Board.dc.html', x: 248, y: 50, w: 784, h: 120, note: 'board header' }],
  },
  render: (args) => (
    <div className="w-192 bg-sunken px-6 pt-3.5">
      <PageTitle
        {...args}
        breadcrumbs={[{ label: 'Projects' }, { label: 'Platform Core' }, { label: 'PLT board' }]}
        meta={[
          'Sep 23 – Oct 7',
          <span key="d" className="font-medium text-tx">
            2 days remaining
          </span>,
          'Goal: Auth service in production behind flag',
        ]}
        actions={
          <>
            <Button>Insights</Button>
            <Button>Complete sprint</Button>
            <IconButton label="More" icon="more" variant="secondary" />
          </>
        }
      />
    </div>
  ),
};

export const Settings: Story = {
  args: { title: 'Appearance' },
  parameters: {
    mock: [
      {
        file: 'Bemmoly Appearance Settings.dc.html',
        x: 272,
        y: 70,
        w: 1056,
        h: 110,
        note: 'settings header',
      },
    ],
  },
  render: (args) => (
    <div className="w-260 bg-sunken p-2">
      <PageTitle
        {...args}
        variant="settings"
        breadcrumbs={[{ label: 'Workspace settings' }, { label: 'Appearance' }]}
        description="Sets the default look for everyone in Acme Labs. People can still choose light or dark for themselves in their profile."
        actions={
          <>
            <Button>Discard</Button>
            <Button variant="primary">Save for workspace</Button>
          </>
        }
      />
    </div>
  ),
};

export const IssueBreadcrumbs: Story = {
  args: { title: '' },
  parameters: {
    mock: [{ file: 'Bemmoly Issue.dc.html', x: 230, y: 56, w: 400, h: 40, note: 'issue trail' }],
  },
  render: () => (
    <Breadcrumbs
      items={[
        { label: 'Platform Core', href: '#board' },
        { label: 'Auth service', icon: <span className="size-2.25 rounded-tick bg-acc" /> },
        { label: <KeyChip issueKey="PLT-204" size="md" />, icon: <TypeGlyph type="story" /> },
      ]}
    />
  ),
};
