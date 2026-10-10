import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { PageTitle } from '../page-title/page-title.tsx';
import { Switch } from '../switch/switch.tsx';
import { SettingsContent, SettingsFrame, SettingsRow } from './settings-frame.tsx';
import { SettingsSection } from './settings-section.tsx';

const meta = { title: 'Components/SettingsFrame', component: SettingsFrame } satisfies Meta<
  typeof SettingsFrame
>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A settings page's content beside a rail; the app sidebar shows the settings contents. */
export const WithPreviewRail: Story = {
  args: { children: null },
  parameters: { layout: 'fullscreen' },
  render: function Render() {
    const [sso, setSso] = useState(true);
    return (
      <div className="flex h-150">
        <SettingsFrame
          aside={
            <aside className="w-80 shrink-0 border-l border-line bg-sunken p-4 text-12 text-tx-3">
              Preview
            </aside>
          }
        >
          <SettingsContent>
            <PageTitle variant="settings" title="Sign-in and SSO" />
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
