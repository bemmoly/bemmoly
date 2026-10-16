import { useGlobalKeys, useT } from '@bemmoly/core-web';
import type { ScopeRef } from '@bemmoly/module-pipelines/shared';
import { Button, Kbd } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useRef, useState } from 'react';
import { useBindings } from '../../../hooks/use-access.ts';
import { useDomains, useGroups } from '../../../hooks/use-catalog-tree.ts';
import { useScope } from '../../../hooks/use-scope.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { Area } from '../../../parts/area.tsx';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../../parts/rows-skeleton.tsx';
import { Panel } from '../../../parts/screen.tsx';
import { useScopeName } from '../../screen-frame.tsx';
import { AddBinding } from './add-binding.tsx';
import { Bindings } from './bindings.tsx';
import { Checker } from './checker.tsx';
import { Policies } from './policies.tsx';
import { ScopeTree } from './scope-tree.tsx';

/** The scope as the API names it, once the domain's and group's ids are known. */
function useScopeRef(): ScopeRef | null {
  const { domain, group } = useScope();
  const domains = useDomains().data?.items;
  const groups = useGroups(domain).data?.items;
  if (!domain) return { kind: 'organisation' };
  const id = group
    ? groups?.find((item) => item.key === group)?.id
    : domains?.find((item) => item.key === domain)?.id;
  return id ? { kind: group ? 'group' : 'domain', id } : null;
}

/**
 * Platform › Access: who may do what, and why. The scope tree on the left, the bindings at
 * that scope with the inherited ones marked, the policies as sentences or code, and the
 * checker on the right. N adds a binding; C goes to the checker.
 */
export default function AccessArea() {
  const t = useT(pipelinesText);
  const { path } = useScope();
  const scopeName = useScopeName();
  const scopeRef = useScopeRef();
  const bindings = useBindings(path);
  const [adding, setAdding] = useState(false);
  const person = useRef<HTMLButtonElement>(null);
  useGlobalKeys({ n: () => setAdding(true), c: () => person.current?.focus() });
  return (
    <div className="mx-auto grid w-full max-w-360 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden border-e border-line px-3 py-4 lg:block">
        <ScopeTree />
      </aside>
      <Area
        title={t('pipelines.access.title')}
        meta={
          bindings.data &&
          t('pipelines.access.meta', { scope: scopeName, count: bindings.data.owningTeams })
        }
        actions={
          <Button variant="primary" onClick={() => setAdding(true)} disabled={!scopeRef}>
            <Icon name="plus" size={14} />
            {t('pipelines.access.addBinding')}
            <span className="hidden md:inline-flex">
              <Kbd keys="N" />
            </span>
          </Button>
        }
        className="max-w-none"
      >
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Panel flush title={t('pipelines.access.bindingsTitle')}>
              {bindings.isError ? (
                <LoadFailed
                  size="sm"
                  className="m-3"
                  error={bindings.error}
                  onRetry={() => void bindings.refetch()}
                />
              ) : bindings.data ? (
                <>
                  <Bindings items={bindings.data.items} />
                  <p className="px-4 py-3 text-12 text-tx-3">
                    {t('pipelines.access.owningNote', {
                      count: bindings.data.owningTeams,
                      scope: scopeName,
                    })}
                  </p>
                </>
              ) : (
                <RowsSkeleton columns={4} rows={5} />
              )}
            </Panel>
            <Policies scope={path} scopeName={scopeName} />
          </div>
          <Checker personRef={person} />
        </div>
      </Area>
      <AddBinding
        open={adding}
        onClose={() => setAdding(false)}
        scope={scopeRef}
        scopeName={scopeName}
      />
    </div>
  );
}
