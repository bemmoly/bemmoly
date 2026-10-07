import { Fragment, type ReactNode } from 'react';
import type { SettingsGroup, SettingsItem } from './sections.ts';

export interface SettingsLinkProps {
  item: SettingsItem;
  active: boolean;
  className: string;
  children: ReactNode;
}

interface SettingsFrameProps {
  title: string;
  groups: readonly SettingsGroup[];
  activePath: string;
  /** The router's link component, so this frame stays router-agnostic for module chunks. */
  renderLink: (props: SettingsLinkProps) => ReactNode;
  children: ReactNode;
}

const ITEM = 'flex justify-between rounded-control px-2.5 py-1.75 no-underline';
const ITEM_IDLE = 'text-tx2 hover:bg-bg2';
const ITEM_ACTIVE = 'bg-ac-bg font-medium text-ac';

/** Measured from the People and Appearance Settings mocks: a 240px sidebar beside the page. */
export function SettingsFrame({
  title,
  groups,
  activePath,
  renderLink,
  children,
}: SettingsFrameProps) {
  return (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label="Settings"
        className="flex w-60 shrink-0 flex-col gap-3.5 overflow-auto border-r border-br bg-sf px-2 py-4"
      >
        <div className="px-2.5 pb-1 text-brand font-semibold text-tx">{title}</div>
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-px">
            <div className="px-2.5 pt-1 pb-1.5 text-mono font-medium tracking-[.07em] text-tx5 uppercase">
              {group.label}
            </div>
            {group.items.map((entry) => {
              const active = activePath === entry.path || activePath.startsWith(`${entry.path}/`);
              return (
                <Fragment key={entry.id}>
                  {renderLink({
                    item: entry,
                    active,
                    className: `${ITEM} ${active ? ITEM_ACTIVE : ITEM_IDLE}`,
                    children: (
                      <>
                        {entry.label}
                        {entry.count === undefined ? null : (
                          <span className="font-mono text-mono font-medium text-tx5">
                            {entry.count}
                          </span>
                        )}
                      </>
                    ),
                  })}
                </Fragment>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
