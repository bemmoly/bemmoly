import {
  buildSettingsNav,
  ModuleTile,
  SidebarHeading,
  SidebarRow,
  typingInField,
  useFrame,
  type SettingsGroup,
} from '@bemmoly/core-web';
import { Kbd } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useDirectory } from '../../hooks/use-directory.ts';
import { updatesQuery } from '../../hooks/use-updates.ts';
import type { Shell } from '../../hooks/use-shell.ts';
import { viewerOf } from '../../lib/session.ts';
import { useUiStore } from '../../store/ui.ts';
import { SidebarFoot, SidebarTop, UserMenu } from './sidebar-parts.tsx';

const SYSTEM = 'workspace.system.manage';

/** The settings groups this person may open, with the members count and an update's version. */
export function useSettingsGroups(shell: Shell): SettingsGroup[] {
  const people = shell.me.can('workspace.roles.manage');
  const { directory, isSuccess } = useDirectory(people);
  const updates = useQuery({
    ...updatesQuery,
    enabled: shell.me.can(SYSTEM),
    staleTime: 10 * 60_000,
  });
  const available = updates.data?.available?.version;
  return buildSettingsNav(shell.modules, viewerOf(shell.me), {
    ...(people && isSuccess ? { counts: { users: directory.counts.active } } : {}),
    ...(available ? { badges: { updates: available } } : {}),
  });
}

/** Escape anywhere on a settings page, outside a field, dialog or menu, goes back to the app. */
function useEscapeBack(back: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || typingInField(event.target)) return;
      if (document.querySelector('dialog[open], [role="menu"], [role="listbox"]')) return;
      back();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [back]);
}

/**
 * The same sidebar in settings mode (docs/design/premium/kit.js, `settingsSidebar`): Back to
 * app (Esc) on top, then Account, Workspace, People, Modules and System, every row with its
 * icon, the members count and an update's version on Updates. Only pages the person may open
 * are listed.
 */
export function SettingsSidebar({ shell }: { shell: Shell }) {
  const { mode, navigate } = useFrame();
  const rail = mode === 'rail';
  const appPath = useUiStore((state) => state.appPath);
  const groups = useSettingsGroups(shell);
  const back = useCallback(() => navigate(appPath), [navigate, appPath]);
  useEscapeBack(back);
  return (
    <>
      <SidebarTop shell={shell} />
      <SidebarRow
        label="Back to app"
        icon="back"
        path={appPath}
        active={false}
        keys="Esc"
        end={rail ? null : <Kbd keys="Esc" className="ml-auto" />}
      />
      <nav
        aria-label="Settings"
        className={`-mx-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2 ${rail ? 'mx-0 items-center px-0' : ''}`}
      >
        {groups.map((group) => (
          <div key={group.id} className={`flex flex-col gap-0.5 ${rail ? 'items-center' : ''}`}>
            <SidebarHeading label={group.label} />
            {group.items.map((item) => (
              <SidebarRow
                key={item.id}
                label={item.label}
                icon={
                  item.moduleId ? (
                    <ModuleTile
                      manifest={
                        shell.modules.find((module) => module.id === item.moduleId) ?? {
                          id: item.moduleId,
                        }
                      }
                      size={15}
                    />
                  ) : (
                    item.icon
                  )
                }
                path={item.path}
                {...(item.path.includes('#') ? { active: false } : {})}
                {...(item.count === undefined ? {} : { count: item.count })}
                {...(item.badge
                  ? {
                      end: (
                        <span className="ml-auto rounded-full bg-acc-50 px-1.5 text-11 leading-4.25 font-semibold text-acc tabular-nums">
                          {item.badge}
                        </span>
                      ),
                    }
                  : {})}
                testId={`settings-${item.id}`}
              />
            ))}
          </div>
        ))}
      </nav>
      <SidebarFoot>
        <UserMenu shell={shell} />
      </SidebarFoot>
    </>
  );
}
