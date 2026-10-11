import { FrameContext, SidebarHeading, SidebarRow, type FrameState } from '@bemmoly/core-web';
import { BrandBlock, EntityTile, Kbd } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useWorkspace } from '../../../hooks/use-workspace.ts';

const noop = () => undefined;

/**
 * The real sidebar rows in a still frame: the preview canvas is inert, so a row only shows how
 * the theme draws it. Board or Docs is the current page, as the preview beside it.
 */
export function PreviewSidebar({ active }: { active: 'board' | 'docs' }) {
  const workspace = useWorkspace();
  const frame: FrameState = {
    mode: 'full',
    phone: false,
    pathname: active === 'board' ? '/work/board/PLT' : '/docs/s/ENG',
    navigate: noop,
    openSheet: noop,
    toggleSidebar: noop,
  };
  return (
    <FrameContext.Provider value={frame}>
      <aside
        inert
        className="flex w-55 shrink-0 flex-col gap-0.5 border-r border-line bg-side px-2 pt-2.5"
      >
        <BrandBlock workspaceName={workspace.name} />
        <span className="mx-0.5 mb-2.5 flex h-7.5 items-center gap-2 rounded-control bg-card px-2 text-13 text-tx-3 shadow-e1">
          <Icon name="search" size={15} />
          <span className="flex-1">Search</span>
          <Kbd keys="Mod+K" />
        </span>
        <SidebarRow label="Home" icon="home" path="/" exact />
        <SidebarRow label="Inbox" icon="inbox" path="/inbox" pill={3} />
        <SidebarRow label="My issues" icon="me" path="/work/my-issues" />
        <SidebarHeading
          label="Work"
          tile={<EntityTile name="Work" tone="work" icon="board" size={14} />}
        />
        <SidebarRow
          label="Platform Core"
          icon={<EntityTile name="Platform Core" size={18} />}
          path="/work/projects/PLT"
        />
        <SidebarRow child label="Board" icon="board" path="/work/board/PLT" />
        <SidebarRow child label="Backlog" icon="backlog" path="/work/backlog/PLT" />
        <SidebarHeading
          label="Docs"
          tile={<EntityTile name="Docs" tone="docs" icon="doc" size={14} />}
        />
        <SidebarRow
          label="Engineering"
          icon={<EntityTile name="Engineering" size={18} />}
          path="/docs/s/ENG"
        />
      </aside>
    </FrameContext.Provider>
  );
}
