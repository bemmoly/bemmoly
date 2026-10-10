import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from '../button/icon-button.tsx';
import { BrandBlock, BrandRailFoot, BrandRailTop } from './brand-block.tsx';

const meta = { title: 'Foundations/BrandBlock', component: BrandBlock } satisfies Meta<
  typeof BrandBlock
>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A stand-in customer logo for the fictional Acme Labs, as in the design review. */
const ACME = {
  name: 'Acme Labs',
  src: `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="#E8590C"/><path d="M6.5 17.5 12 6l5.5 11.5M8.8 13h6.4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  )}`,
};

const toggle = <IconButton label="Collapse sidebar" icon="sidebar" size="xs" />;

const Side = ({ children, dark }: { children: React.ReactNode; dark?: boolean }) => (
  <div
    data-theme={dark ? 'dark' : 'light'}
    className="w-60 rounded-card bg-side px-2 pt-2.5 pb-2 shadow-e1"
  >
    {children}
  </div>
);

/** Default, custom logo, and dark: the review's logo placement sheet. */
export const Placements: Story = {
  args: { workspaceName: 'Acme Labs' },
  render: () => (
    <div className="flex flex-wrap gap-5">
      <Side>
        <BrandBlock workspaceName="Acme Labs" onWorkspaceMenu={() => {}} sidebarToggle={toggle} />
      </Side>
      <Side>
        <BrandBlock workspaceName="Acme Labs" customLogo={ACME} sidebarToggle={toggle} />
      </Side>
      <Side dark>
        <BrandBlock workspaceName="Acme Labs" onWorkspaceMenu={() => {}} sidebarToggle={toggle} />
      </Side>
    </div>
  ),
};

/** The collapsed rail: the mark leads; under a customer logo it moves to the foot. */
export const CollapsedRail: Story = {
  args: { workspaceName: 'Acme Labs' },
  render: () => (
    <div className="flex gap-6">
      {[null, ACME].map((logo) => (
        <div
          key={logo ? 'custom' : 'plain'}
          className="flex h-90 w-14 flex-col items-center gap-2 rounded-card bg-side py-3 shadow-e1"
        >
          <BrandRailTop customLogo={logo} />
          <span className="mt-auto">
            <BrandRailFoot customLogo={logo} version="0.4.0" />
          </span>
        </div>
      ))}
    </div>
  ),
};
