import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../button/button.tsx';
import { PageTitle } from '../page-title/page-title.tsx';
import { Switch } from '../switch/switch.tsx';
import { SettingsContent, SettingsFrame, SettingsRow } from './settings-frame.tsx';
import { SettingsNav, SettingsNavItem, SettingsNavSection } from './settings-nav.tsx';
import { SettingsSection } from './settings-section.tsx';

const meta = { title: 'Components/SettingsFrame', component: SettingsFrame } satisfies Meta<
  typeof SettingsFrame
>;

export default meta;

type Story = StoryObj<typeof meta>;

const NAV: [string, [string, number?][]][] = [
  ['General', [['Workspace details'], ['Appearance'], ['AI and models']]],
  ['People', [['Users', 42], ['Teams', 6], ['Roles and permissions'], ['Authentication (SSO)']]],
  ['Work', [['Issue types and fields'], ['Workflows']]],
  ['System', [['Storage and backups'], ['Updates'], ['Audit log']]],
];

export const WorkspaceSettings: Story = {
  args: { nav: null, children: null },
  parameters: {
    layout: 'fullscreen',
    mock: [
      {
        file: 'Bemmoly People.dc.html',
        x: 0,
        y: 48,
        w: 240,
        h: 590,
        note: 'Workspace settings nav',
      },
    ],
  },
  render: function Render() {
    const [page, setPage] = useState('Users');
    const [sso, setSso] = useState(true);
    return (
      <div className="flex h-150">
        <SettingsFrame
          nav={
            <SettingsNav title="Workspace settings">
              {NAV.map(([section, items]) => (
                <SettingsNavSection key={section} label={section}>
                  {items.map(([name, count]) => (
                    <SettingsNavItem
                      key={name}
                      active={page === name}
                      {...(count !== undefined ? { count } : {})}
                      onClick={() => setPage(name)}
                    >
                      {name}
                    </SettingsNavItem>
                  ))}
                </SettingsNavSection>
              ))}
            </SettingsNav>
          }
        >
          <SettingsContent>
            <PageTitle
              variant="settings"
              title={page}
              breadcrumbs={[{ label: 'Workspace settings' }, { label: page }]}
              actions={<Button variant="primary">Save</Button>}
            />
            <SettingsSection title="Policy" layout="rows" className="w-100">
              <SettingsRow
                title="Require SSO for everyone"
                description="Password login disabled except for break-glass admins."
                control={<Switch aria-label="Require SSO" checked={sso} onCheckedChange={setSso} />}
              />
              <SettingsRow
                title="Map IdP groups to teams"
                description="eng-platform maps to Platform. 2 mappings."
                control={<span className="font-medium text-ac">Edit</span>}
              />
            </SettingsSection>
          </SettingsContent>
        </SettingsFrame>
      </div>
    );
  },
};

export const ProjectSettingsNav: Story = {
  args: { nav: null, children: null },
  parameters: {
    layout: 'fullscreen',
    mock: [
      {
        file: 'Bemmoly Board Settings.dc.html',
        x: 0,
        y: 48,
        w: 240,
        h: 852,
        note: 'project settings',
      },
    ],
  },
  render: () => (
    <div className="flex h-213">
      <SettingsNav
        title={
          <div className="flex items-center gap-2.5 px-2 pt-0 pb-0">
            <span className="flex size-8 items-center justify-center rounded-panel bg-ac-fill font-semibold text-on-ac">
              PC
            </span>
            <div className="flex flex-col gap-px">
              <span className="text-13h font-semibold">Platform Core</span>
              <span className="text-12 text-tx4">Project settings</span>
            </div>
          </div>
        }
        footer={
          <>
            <span>
              You&apos;re a <b className="text-tx">Project admin</b>.
            </span>
            <span>
              Org-level defaults are set in <span className="text-ac">Workspace settings</span>.
            </span>
          </>
        }
      >
        <SettingsNavSection label="Project">
          <SettingsNavItem>Details</SettingsNavItem>
          <SettingsNavItem count={14}>Access</SettingsNavItem>
          <SettingsNavItem>Notifications</SettingsNavItem>
        </SettingsNavSection>
        <SettingsNavSection label="Work">
          <SettingsNavItem meta="Org default">Issue types</SettingsNavItem>
          <SettingsNavItem meta="Overridden" metaTone="accent">
            Fields
          </SettingsNavItem>
          <SettingsNavItem meta="Org default">Workflow</SettingsNavItem>
          <SettingsNavItem active>Board</SettingsNavItem>
          <SettingsNavItem>Sprints and estimation</SettingsNavItem>
          <SettingsNavItem>Automation</SettingsNavItem>
        </SettingsNavSection>
      </SettingsNav>
    </div>
  ),
};
