import { Link, useRouterState } from '@tanstack/react-router';
import { PEOPLE_PATHS, useTopBar } from '../../hooks/use-top-bar.ts';
import { Avatar, Dropdown, TopBar } from '../../ui.ts';
import { InboxButton } from './inbox-button.tsx';
import { SearchTriggers } from './search-triggers.tsx';

const NAV_LINK =
  'flex cursor-pointer items-center gap-1 border-0 bg-transparent px-2.5 py-1.5 font-sans text-nav text-tx2 no-underline hover:text-tx';
const NAV_ACTIVE = 'font-medium text-tx shadow-[inset_0_-2px_0_var(--ac)]';
const CARET = <span className="text-micro text-tx5">▾</span>;

/** The Home mock's top bar: nav from the module manifest, Create, search, Ask, inbox, theme, you. */
export function AppTopBar() {
  const { me, workspace, topEntries, peopleItems, createItems, themeItems, accountItems } =
    useTopBar();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onPeople = PEOPLE_PATHS.some((path) => pathname.startsWith(path));

  const navigation = (
    <nav aria-label="Main" className="flex gap-0.5">
      <Link
        to="/"
        className={NAV_LINK}
        activeOptions={{ exact: true }}
        activeProps={{ className: NAV_ACTIVE }}
      >
        Your work
      </Link>
      <nav aria-label="Modules" className="contents">
        {topEntries.map((entry) => (
          <Link
            key={entry.id}
            to={entry.path}
            className={NAV_LINK}
            activeProps={{ className: NAV_ACTIVE }}
          >
            {entry.label}
          </Link>
        ))}
      </nav>
      {peopleItems.length > 0 ? (
        <Dropdown
          label="Teams"
          triggerClassName={`${NAV_LINK} ${onPeople ? NAV_ACTIVE : ''}`}
          trigger={<>Teams {CARET}</>}
          items={peopleItems}
        />
      ) : null}
    </nav>
  );

  const create =
    createItems.length > 0 ? (
      <Dropdown
        label="Create"
        triggerClassName="ml-1.5 cursor-pointer rounded-control border-0 bg-ac px-3.5 py-1.5 font-sans text-base font-medium text-on-ac hover:bg-ac-d"
        trigger="Create"
        items={createItems}
      />
    ) : null;

  const trailing = (
    <>
      <SearchTriggers />
      <InboxButton />
      {themeItems.length > 0 ? (
        <Dropdown
          label="Theme"
          align="end"
          triggerClassName="grid size-8 cursor-pointer place-items-center rounded-control border-0 bg-transparent text-tx2 hover:bg-bg2"
          trigger={
            <span
              aria-hidden="true"
              className="size-3.5 rounded-full border-[1.5px] border-current shadow-[inset_0_0_0_3px_var(--sf),inset_0_0_0_4.5px_currentColor]"
            />
          }
          items={themeItems}
        />
      ) : null}
      <Dropdown
        label="Account"
        align="end"
        triggerClassName="ml-1 cursor-pointer rounded-full border-0 bg-transparent p-0"
        trigger={<Avatar name={me.user.name} size={30} />}
        header={
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-tx">{me.user.name}</span>
            <span className="text-caption text-tx5">{me.user.email}</span>
          </div>
        }
        items={accountItems}
      />
    </>
  );

  return (
    <TopBar
      workspaceName={workspace.name}
      renderHome={(className, children) => (
        <Link to="/" className={className} aria-label={`${workspace.name} home`}>
          {children}
        </Link>
      )}
      navigation={navigation}
      create={create}
      trailing={trailing}
    />
  );
}
