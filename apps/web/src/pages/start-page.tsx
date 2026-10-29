import { PageLayout, productsOf, START_PATH, type Product } from '@bemmoly/core-web';
import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { AskBox } from '../components/start/ask-box.tsx';
import { ProductCards } from '../components/start/product-cards.tsx';
import { changedAt, StartList } from '../components/start/start-list.tsx';
import { useModules } from '../hooks/use-modules.ts';
import { useShell } from '../hooks/use-shell.ts';
import { useStartSummaries, type StartRow } from '../hooks/use-start-summaries.ts';
import { NoModules } from './home-page.tsx';

function greeting(now: Date): string {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

function needsLine(count: number | null): string {
  if (count === null) return '';
  if (count === 0) return 'Nothing needs you right now';
  return `${count} ${count === 1 ? 'thing needs' : 'things need'} you`;
}

const dueOn = (row: StartRow, product: Product | undefined) =>
  row.at
    ? new Date(row.at).toLocaleDateString('en', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : product
      ? `Open in ${product.name}`
      : null;

/**
 * The start page (docs/proposals/suite, section 04): the suite's front door after sign-in.
 * Only the products the person can use, what each needs from them, their recent items, and
 * one question box. It points into products and never copies their screens.
 */
export function StartPage() {
  const shell = useShell();
  const { data: manifests = [] } = useModules();
  const products = productsOf(manifests);
  const summaries = useStartSummaries();
  const loading = summaries.isPending;
  const now = new Date();
  const first = shell.me.user.name.split(' ')[0] ?? shell.me.user.name;
  const date = now.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
  const across = new Set(summaries.needs.map((row) => row.moduleId)).size;
  return (
    <PageLayout
      layout="contained"
      header={{
        crumbs: [{ label: 'Start', path: START_PATH, icon: <Icon name="home" size={15} /> }],
      }}
      title={['Start', shell.workspace.name]}
    >
      <div className="flex flex-col gap-7" data-testid="start-page">
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 text-24 font-semibold tracking-display text-tx">
            {greeting(now)}, {first}
          </h1>
          <p className="m-0 text-13 text-tx-3">
            {date}
            {loading || summaries.isError ? '' : ` · ${needsLine(summaries.needsTotal)}`}
          </p>
        </div>
        <AskBox aiEnabled={shell.workspace.aiEnabled} />
        {products.length === 0 ? (
          <NoModules canEnable={shell.me.can('workspace.modules.manage')} />
        ) : (
          <>
            <ProductCards products={products} waiting={summaries.waiting} loading={loading} />
            {summaries.isError ? (
              <section className="rounded-card bg-card shadow-e1">
                <EmptyState
                  title="What your products hold for you did not load"
                  action={
                    <Button variant="secondary" onClick={() => void summaries.refetch()}>
                      Try again
                    </Button>
                  }
                />
              </section>
            ) : (
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                <StartList
                  id="start-needs"
                  title="Needs you"
                  meta={
                    summaries.needsTotal > 0
                      ? `${summaries.needsTotal} across ${across} ${across === 1 ? 'product' : 'products'}`
                      : undefined
                  }
                  rows={summaries.needs}
                  products={products}
                  loading={loading}
                  empty="Nothing needs you right now. Reviews, due work and requests land here."
                  trailing={dueOn}
                />
                <StartList
                  id="start-recent"
                  title="Recent"
                  rows={summaries.recent}
                  products={products}
                  loading={loading}
                  empty="Issues and pages you work on show up here."
                  trailing={changedAt}
                />
              </div>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}
