import {
  barIcon,
  CreateMenuEmpty,
  CreateMenuItem,
  IconButton,
  Menu,
  MenuItem,
  TopBar,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useTopBar } from '../../hooks/use-top-bar.ts';
import { RouterLink } from '../router-link.tsx';
import { AnchoredMenu } from './anchored-menu.tsx';

type Bar = ReturnType<typeof useTopBar>;

/** What the enabled modules can make, or why there is nothing yet. */
function CreateMenu({ bar }: { bar: Bar }) {
  if (bar.createItems.length > 0)
    return bar.createItems.map((item) => (
      <CreateMenuItem
        key={item.id}
        icon="plus"
        label={item.label}
        description={item.description}
        onSelect={item.onSelect}
      />
    ));
  return (
    <CreateMenuEmpty
      title="Nothing to create yet"
      description={
        bar.onOpenModules
          ? 'Issues, docs and other work come from modules. Enable one and what it makes shows up here.'
          : 'Issues, docs and other work come from modules. Once an admin enables one, what it makes shows up here.'
      }
      action={
        bar.onOpenModules ? (
          <MenuItem icon={<Icon name="modules" />} onSelect={bar.onOpenModules}>
            Open Settings › Modules
          </MenuItem>
        ) : undefined
      }
    />
  );
}

/**
 * The Home mock's top bar from the design system: navigation from the module
 * manifest, Create, search with its / hint, Ask Bemmoly when an AI provider is
 * chosen, the inbox with its badge, the theme menu and the account menu.
 */
export function AppTopBar() {
  const bar = useTopBar();
  const theme =
    bar.themeItems.length > 0 ? (
      <Menu
        align="end"
        widthClassName="w-56"
        trigger={(props) => <IconButton label="Theme" icon={barIcon('theme')} {...props} />}
      >
        {bar.themeItems.map((item) => (
          <MenuItem
            key={item.id}
            onSelect={item.onSelect}
            {...(item.hint ? { hint: item.hint } : {})}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    ) : null;
  return (
    <>
      <TopBar
        nav={bar.nav}
        linkAs={RouterLink}
        homeHref="/"
        createMenu={<CreateMenu bar={bar} />}
        onSearch={bar.onSearch}
        {...(bar.workspace.aiEnabled ? { onAsk: bar.onSearch } : {})}
        inboxCount={bar.unreadCount}
        onInbox={bar.onInbox}
        extra={theme}
        user={{ name: bar.me.user.name }}
        onUser={() => bar.setAccountOpen(!bar.accountOpen)}
      />
      <AnchoredMenu
        open={bar.accountOpen}
        onClose={() => bar.setAccountOpen(false)}
        label="Account"
      >
        <div className="flex flex-col gap-0.5 border-b border-br2 px-2.5 pt-1 pb-2">
          <span className="font-medium text-tx">{bar.me.user.name}</span>
          <span className="text-12 text-tx5">{bar.me.user.email}</span>
        </div>
        {bar.accountItems.map((item) => (
          <MenuItem key={item.id} onSelect={item.onSelect}>
            {item.label}
          </MenuItem>
        ))}
      </AnchoredMenu>
    </>
  );
}
