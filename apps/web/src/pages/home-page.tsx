import { HomeSections, PageLayout, useFrameLink } from '@bemmoly/core-web';
import { Button, buttonClassName, EmptyState, Kbd, SkeletonCard } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { InboxPreview } from '../components/home/inbox-preview.tsx';
import { JumpBackIn } from '../components/home/jump-back-in.tsx';
import { useInbox } from '../hooks/use-notifications.ts';
import { useShell } from '../hooks/use-shell.ts';
import { HOME_SECTIONS } from '../lib/home-sections.ts';

/** Kinds that ask something of the person, rather than tell them something happened. */
const NEEDS_YOU = new Set(['mention', 'review_request', 'assignment']);

function greeting(now: Date): string {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

function needsLine(count: number | null): string {
  if (count === null) return '';
  if (count === 0) return 'Nothing needs you right now';
  return `${count} ${count === 1 ? 'thing needs' : 'things need'} you today`;
}

/** No module contributes a main card: say where work comes from, with the one next step. */
function NoModules({ canEnable }: { canEnable: boolean }) {
  const modules = useFrameLink('/settings/modules');
  return (
    <section className="rounded-card bg-card shadow-e1">
      <EmptyState
        icon={<Icon name="modules" />}
        title="Issues and docs come from modules"
        description={
          canEnable
            ? 'Turn on Work for issues and boards, or Docs for pages, and your work collects here.'
            : 'An admin turns on Work or Docs in Settings › Modules; your work then collects here.'
        }
        action={
          canEnable ? (
            <a {...modules} className={buttonClassName({ variant: 'primary' })}>
              Open Settings › Modules
            </a>
          ) : undefined
        }
      />
    </section>
  );
}

/** Docs is on and Work is not: the main column is about pages and the inbox. */
function StartHere({ createLabel }: { createLabel: string | null }) {
  return (
    <section className="flex flex-col gap-2 rounded-card bg-card p-4 shadow-e1">
      <h2 className="m-0 text-13 font-semibold">Start here</h2>
      <p className="m-0 flex flex-wrap items-center gap-1.5 text-13 text-tx-2">
        {createLabel ? (
          <>
            Press <Kbd keys="C" /> for a new {createLabel}, or{' '}
          </>
        ) : null}
        <Kbd keys="Mod+K" /> to find anything by name.
      </p>
    </section>
  );
}

/**
 * Home, "Your work" (docs/design/premium/screens.js, `screenHome`): a greeting that says what
 * needs the person today, the last four things they opened, then what modules add (Work's My
 * issues and its sprint) beside the inbox preview.
 */
export function HomePage() {
  const shell = useShell();
  const { items, isPending } = useInbox();
  const now = new Date();
  const first = shell.me.user.name.split(' ')[0] ?? shell.me.user.name;
  const needs = isPending
    ? null
    : items.filter((item) => !item.read && NEEDS_YOU.has(item.kind)).length;
  const hasMain = shell.modules.some((module) => HOME_SECTIONS.has(module.id));
  const date = now.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' });
  return (
    <PageLayout
      layout="contained"
      header={{ crumbs: [{ label: 'Home', path: '/', icon: <Icon name="home" size={15} /> }] }}
      title={['Home', shell.workspace.name]}
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 text-24 font-semibold tracking-display text-tx">
            {greeting(now)}, {first}
          </h1>
          <p className="m-0 text-13 text-tx-3">
            {date}
            {needs === null ? '' : ` · ${needsLine(needs)}`}
          </p>
        </div>
        <JumpBackIn />
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            {hasMain ? (
              <HomeSections
                modules={shell.modules}
                registry={HOME_SECTIONS}
                loading={<SkeletonCard />}
                failed={(manifest, _error, retry) => (
                  <section className="rounded-card bg-card shadow-e1">
                    <EmptyState
                      title={`This ${manifest.name ?? manifest.id} card did not load`}
                      action={
                        <Button variant="secondary" onClick={retry}>
                          Try again
                        </Button>
                      }
                    />
                  </section>
                )}
              />
            ) : shell.modules.length > 0 ? (
              <InboxPreview limit={8} />
            ) : (
              <NoModules canEnable={shell.me.can('workspace.modules.manage')} />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            {hasMain || shell.modules.length === 0 ? (
              <InboxPreview />
            ) : (
              <StartHere createLabel={shell.primaryCreate?.label.toLowerCase() ?? null} />
            )}
            <HomeSections
              slot="aside"
              modules={shell.modules}
              registry={HOME_SECTIONS}
              loading={null}
              failed={() => null}
            />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
