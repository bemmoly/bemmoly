import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { Icon } from '../icons/icon.tsx';
import { AiBrief, AiInsightBar, AiSuggestion, AiSummary } from './ai-surface/ai-cards.tsx';
import { AiActionButton, AiAskButton, AiNotUseful } from './ai-surface/ai-parts.tsx';
import { Avatar } from './avatar/avatar.tsx';
import { AvatarStack } from './avatar/avatar-stack.tsx';
import { Badge } from './badge/badge.tsx';
import { Breadcrumbs } from './breadcrumbs/breadcrumbs.tsx';
import { Button } from './button/button.tsx';
import { IconButton } from './button/icon-button.tsx';
import { Card, CardBody, CardHeader } from './card/card.tsx';
import { Checkbox, Radio } from './checkbox/checkbox.tsx';
import { CommandGroup, CommandItem, CommandList } from './command-palette/command-list.tsx';
import { CommandFooter, CommandInput, CommandPalette } from './command-palette/command-palette.tsx';
import { EmptyState } from './empty-state/empty-state.tsx';
import { PriorityGlyph, TypeGlyph } from './glyphs/glyphs.tsx';
import { Input, SearchInput } from './input/input.tsx';
import { KeyChip } from './key-chip/key-chip.tsx';
import { Logo } from './logo/logo.tsx';
import { Dropdown } from './menu/dropdown-button.tsx';
import { MenuItem } from './menu/menu-item.tsx';
import { PageHeader } from './page-header/page-header.tsx';
import { SegmentedControl } from './segmented-control/segmented-control.tsx';
import { Select } from './select/select.tsx';
import {
  SettingsNav,
  SettingsNavItem,
  SettingsNavSection,
} from './settings-frame/settings-nav.tsx';
import { Skeleton } from './skeleton/skeleton.tsx';
import { StatusBadge, StatusButton } from './status-badge/status-badge.tsx';
import { Switch } from './switch/switch.tsx';
import { Tabs } from './tabs/tabs.tsx';
import { Tag } from './tag/tag.tsx';
import { Textarea } from './textarea/textarea.tsx';
import { Toast } from './toast/toast.tsx';
import { TopBar } from './top-bar/top-bar.tsx';

const noop = () => {};

function Section({
  title,
  children,
  wide,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={wide ? 'col-span-2 flex flex-col gap-2' : 'flex flex-col gap-2'}>
      <h2 className="m-0 text-11 font-medium tracking-caps text-tx5 uppercase">{title}</h2>
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-br bg-sf p-4">
        {children}
      </div>
    </section>
  );
}

function Overview() {
  return (
    <div className="flex w-300 flex-col gap-6">
      <TopBar
        nav={[
          { id: 'work', label: 'Your work' },
          { id: 'projects', label: 'Projects', active: true },
          { id: 'docs', label: 'Docs' },
        ]}
        onCreate={noop}
        onSearch={noop}
        onAsk={noop}
        inboxCount={4}
        onInbox={noop}
        user={{ name: 'Rohan S.', initials: 'RS' }}
      />
      <PageHeader
        breadcrumbs={[{ label: 'Projects' }, { label: 'Platform Core' }, { label: 'PLT board' }]}
        title="PLT Sprint 14"
        meta={['Sep 23 – Oct 7', '2 days remaining']}
        actions={<Button>Insights</Button>}
      />
      <div className="grid grid-cols-2 gap-5">
        <Section title="Buttons">
          <Button variant="primary">Create</Button>
          <Button>Insights</Button>
          <Button variant="ghost">Not useful</Button>
          <Button variant="danger">Delete</Button>
          <Button loading>Saving</Button>
          <IconButton label="Inbox" icon="inbox" badge={4} />
          <IconButton label="More" icon="more" variant="secondary" />
        </Section>
        <Section title="Inputs">
          <Input aria-label="Name" defaultValue="Acme Labs" wrapperClassName="w-50" />
          <SearchInput aria-label="Search" hint="/" placeholder="Search" wrapperClassName="w-50" />
          <Select aria-label="Role" size="sm" options={[{ value: 'm', label: 'Member' }]} />
          <Textarea aria-label="Note" rows={2} className="w-90" />
        </Section>
        <Section title="Toggles">
          <Checkbox aria-label="On" defaultChecked />
          <Checkbox aria-label="Off" />
          <Radio aria-label="Picked" defaultChecked />
          <Switch aria-label="Switch" checked onCheckedChange={noop} />
          <SegmentedControl
            aria-label="Mode"
            value="light"
            onChange={noop}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            className="w-50"
          />
        </Section>
        <Section title="Issue vocabulary">
          <TypeGlyph type="story" />
          <TypeGlyph type="bug" />
          <TypeGlyph type="task" />
          <KeyChip issueKey="PLT-204" />
          <PriorityGlyph priority="highest" />
          <PriorityGlyph priority="medium" />
          <Tag>auth</Tag>
          <Badge tone="ok">ACTIVE</Badge>
          <StatusBadge category="todo" />
          <StatusBadge category="progress" />
          <StatusBadge category="review" />
          <StatusBadge category="qa" />
          <StatusBadge category="done" />
          <StatusButton category="review" />
        </Section>
        <Section title="People and brand">
          <Avatar name="Aisha K." hue="orange" size={28} />
          <AvatarStack
            people={[
              { id: 'a', name: 'Priya N.' },
              { id: 'b', name: 'Jonas M.' },
            ]}
            total={9}
          />
          <Logo variant="lockup" />
          <Logo variant="mark" tone="mono" />
        </Section>
        <Section title="Navigation">
          <Breadcrumbs
            items={[{ label: 'Engineering', href: '#e' }, { label: 'Auth service RFC' }]}
          />
          <Tabs
            aria-label="Tabs"
            value="a"
            onChange={noop}
            items={[
              { value: 'a', label: 'Columns' },
              { value: 'b', label: 'Cards' },
            ]}
          />
          <Dropdown label="Epic" widthClassName="w-55">
            <MenuItem onSelect={noop}>Auth service</MenuItem>
          </Dropdown>
        </Section>
        <Section title="AI surfaces" wide>
          <AiAskButton shortcut="⌘K" />
          <AiInsightBar title="Sprint risk" onDismiss={noop} className="w-full">
            PLT-204 blocks 2 issues.
          </AiInsightBar>
          <AiSummary
            source="from 14 comments"
            className="w-90"
            actions={
              <>
                <AiActionButton>Ping Jonas</AiActionButton>
                <AiNotUseful />
              </>
            }
          >
            Backfill verified on staging.
          </AiSummary>
          <AiBrief title="Your morning brief" className="w-120">
            Two things need you today.
          </AiBrief>
          <AiSuggestion onAccept={noop} onDismiss={noop} className="w-full">
            Move PLT-211 to Sprint 15.
          </AiSuggestion>
        </Section>
        <Section title="Surfaces">
          <Card className="w-70">
            <CardHeader title="Recent docs" />
            <CardBody>
              <Skeleton width="80%" />
            </CardBody>
          </Card>
          <Toast tone="ok" title="Saved" body="Everyone sees the new theme." onDismiss={noop} />
          <EmptyState
            icon={<Icon name="doc" />}
            title="No docs yet"
            description="Pages you edit show up here."
          />
        </Section>
        <Section title="Settings nav">
          <SettingsNav title="Workspace settings" className="h-60">
            <SettingsNavSection label="People">
              <SettingsNavItem active count={42}>
                Users
              </SettingsNavItem>
              <SettingsNavItem count={6}>Teams</SettingsNavItem>
            </SettingsNavSection>
          </SettingsNav>
        </Section>
        <Section title="Command palette" wide>
          <CommandPalette open inline onClose={noop}>
            <CommandInput value="auth" onValueChange={noop} />
            <CommandList>
              <CommandGroup label="Issues">
                <CommandItem
                  icon={<TypeGlyph type="story" size={16} />}
                  issueKey="PLT-204"
                  title="Session store migration"
                  meta="In review"
                  onSelect={noop}
                />
              </CommandGroup>
            </CommandList>
            <CommandFooter />
          </CommandPalette>
        </Section>
      </div>
    </div>
  );
}

const meta = { title: 'Overview/All components', component: Overview } satisfies Meta<
  typeof Overview
>;

export default meta;

export const AllComponents: StoryObj<typeof meta> = {};
