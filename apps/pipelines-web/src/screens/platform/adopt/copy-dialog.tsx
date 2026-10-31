import { useT } from '@bemmoly/core-web';
import type { CopyResult, Environment } from '@bemmoly/module-pipelines/shared';
import { Button, EmptyState, Field, Modal, Select, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState, type KeyboardEvent } from 'react';
import { useCopy, useCopyPlan } from '../../../hooks/use-adoption.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { CopyItems } from './copy-items.tsx';
import { copyBodyOf, copyDraftOf, type CopyDraft } from './draft.ts';

const EVERY = '';

/** The environment just before this one, or the first other one: where a copy usually comes from. */
function sourceFor(target: Environment, environments: readonly Environment[]) {
  const others = [...environments].filter((e) => e.id !== target.id);
  const before = others.filter((e) => e.position < target.position).at(-1);
  return (before ?? others[0])?.key ?? null;
}

/**
 * Copy configuration into an environment: choose where from and which applications, then see
 * every item that differs with its tick and, for each secret, how it travels. The runtime
 * choice, addresses and deployments are never copied. Cmd+Enter copies.
 */
export function CopyDialog({
  environment,
  environments,
  onClose,
}: {
  environment: Environment;
  environments: readonly Environment[];
  onClose: () => void;
}) {
  const t = useT(pipelinesText);
  const [from, setFrom] = useState<string | null>(sourceFor(environment, environments));
  const [application, setApplication] = useState(EVERY);
  const plan = useCopyPlan(environment.key, from, null);
  const copy = useCopy(environment.key);
  const [draft, setDraft] = useState<CopyDraft | null>(null);
  const [done, setDone] = useState<CopyResult | null>(null);
  const current = draft ?? (plan.data ? copyDraftOf(plan.data) : null);
  const shown = plan.data
    ? {
        ...plan.data,
        applications: plan.data.applications.filter(
          (app) => application === EVERY || app.application.key === application,
        ),
      }
    : null;
  const body = shown && current ? copyBodyOf(shown, current) : null;
  const submit = () => {
    if (!body || copy.isPending) return;
    copy.mutate(body, { onSuccess: setDone });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };
  const update = (change: (draft: CopyDraft) => CopyDraft) => current && setDraft(change(current));
  const tick = (id: string, on: boolean) =>
    update((now) => {
      const ticked = new Set(now.ticked);
      if (on) ticked.add(id);
      else ticked.delete(id);
      return { ...now, ticked };
    });
  const footer = done ? (
    <Button variant="primary" onClick={onClose}>
      {t('pipelines.adopt.finished')}
    </Button>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>
        {t('pipelines.common.cancel')}
      </Button>
      <Button variant="primary" disabled={!body} loading={copy.isPending} onClick={submit}>
        {t('pipelines.copy.submit', { count: body?.items.length ?? 0 })}
      </Button>
    </>
  );
  return (
    <Modal
      open
      width="xl"
      onClose={onClose}
      title={t('pipelines.copy.title', { environment: environment.name })}
      description={t('pipelines.copy.description')}
      footer={footer}
    >
      <div className="flex flex-col gap-3" onKeyDown={onKeyDown}>
        {done ? (
          <p role="status" className="flex items-start gap-2 text-13 text-tx">
            <Icon name="check" size={14} className="mt-0.5 shrink-0" />
            {t('pipelines.copy.done', { count: done.applied, environment: environment.name })}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('pipelines.copy.from')}>
                <Select
                  value={from ?? ''}
                  placeholder={t('pipelines.copy.chooseFrom')}
                  options={environments
                    .filter((e) => e.id !== environment.id)
                    .map((e) => ({ value: e.key, label: e.name }))}
                  onChange={(event) => {
                    setFrom(event.value);
                    setDraft(null);
                  }}
                />
              </Field>
              <Field label={t('pipelines.copy.applications')}>
                <Select
                  searchable
                  value={application}
                  options={[
                    { value: EVERY, label: t('pipelines.copy.every') },
                    ...(plan.data?.applications ?? []).map((app) => ({
                      value: app.application.key,
                      label: app.application.key,
                    })),
                  ]}
                  onChange={(event) => setApplication(event.value)}
                />
              </Field>
            </div>
            {plan.data?.secretMode === 'needs-value' && (
              <p className="flex items-start gap-2 rounded-control bg-line-2 px-3 py-2 text-12 text-tx-2">
                <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
                {t('pipelines.copy.prodSecrets', { environment: environment.name })}
              </p>
            )}
            {plan.isError ? (
              <ActionError error={plan.error} />
            ) : !from ? null : !shown || !current ? (
              <div aria-busy className="flex flex-col gap-3">
                <Skeleton height={96} />
                <Skeleton height={96} />
              </div>
            ) : shown.applications.length === 0 ? (
              <EmptyState
                icon={<Icon name="check" size={18} />}
                title={t('pipelines.copy.emptyTitle')}
                description={t('pipelines.copy.emptyDescription', {
                  from: shown.from.name,
                  to: shown.to.name,
                })}
                headingLevel={3}
              />
            ) : (
              shown.applications.map((app) => (
                <CopyItems
                  key={app.application.key}
                  plan={shown}
                  app={app}
                  draft={current}
                  onTick={tick}
                  onMode={(id, mode) =>
                    update((now) => ({ ...now, modes: new Map(now.modes).set(id, mode) }))
                  }
                />
              ))
            )}
            <p className="text-12 text-tx-3">{t('pipelines.copy.notCopied')}</p>
          </>
        )}
        <ActionError error={copy.error} />
      </div>
    </Modal>
  );
}
