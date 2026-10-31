import { useT } from '@bemmoly/core-web';
import type { AdoptResult, Environment } from '@bemmoly/module-pipelines/shared';
import { Button, EmptyState, Modal, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState, type KeyboardEvent } from 'react';
import { useAdopt, useAdoptionPlan } from '../../../hooks/use-adoption.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { AdoptService } from './adopt-service.tsx';
import { adoptBodyOf, adoptDraftOf, type AdoptChoice, type AdoptDraft } from './draft.ts';

/**
 * Adopt services: the Cloud Run services already running in an environment's project, each
 * matched to an application by name, with what adopting it would import. Reading the plan
 * changes nothing in the cloud; adopting changes only Pipelines. Cmd+Enter adopts.
 */
export function AdoptDialog({
  environment,
  onClose,
}: {
  environment: Environment;
  onClose: () => void;
}) {
  const t = useT(pipelinesText);
  const plan = useAdoptionPlan(environment.key);
  const adopt = useAdopt(environment.key);
  const [draft, setDraft] = useState<AdoptDraft | null>(null);
  const [done, setDone] = useState<AdoptResult | null>(null);
  const current = draft ?? (plan.data ? adoptDraftOf(plan.data) : null);
  const body = plan.data && current ? adoptBodyOf(plan.data, current) : null;
  const submit = () => {
    if (!body || adopt.isPending) return;
    adopt.mutate(body, { onSuccess: setDone });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };
  const choose = (service: string, choice: AdoptChoice) =>
    setDraft({ ...(current ?? {}), [service]: choice });
  const footer = done ? (
    <Button variant="primary" onClick={onClose}>
      {t('pipelines.adopt.finished')}
    </Button>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>
        {t('pipelines.common.cancel')}
      </Button>
      <Button variant="primary" disabled={!body} loading={adopt.isPending} onClick={submit}>
        {t('pipelines.adopt.submit', { count: body?.services.length ?? 0 })}
      </Button>
    </>
  );
  return (
    <Modal
      open
      width="xl"
      onClose={onClose}
      title={t('pipelines.adopt.title', { environment: environment.name })}
      description={
        plan.data
          ? t('pipelines.adopt.description', {
              project: plan.data.project,
              region: plan.data.region,
            })
          : t('pipelines.adopt.looking')
      }
      footer={footer}
    >
      <div className="flex flex-col gap-3" onKeyDown={onKeyDown}>
        {done ? (
          <p role="status" className="flex items-start gap-2 text-13 text-tx">
            <Icon name="check" size={14} className="mt-0.5 shrink-0" />
            {t('pipelines.adopt.done', { count: done.adopted.length })}
          </p>
        ) : plan.isError ? (
          <ActionError error={plan.error} />
        ) : !plan.data || !current ? (
          <div aria-busy className="flex flex-col gap-3">
            <Skeleton height={96} />
            <Skeleton height={96} />
          </div>
        ) : plan.data.services.length === 0 ? (
          <EmptyState
            icon={<Icon name="cloud" size={18} />}
            title={t('pipelines.adopt.emptyTitle')}
            description={t('pipelines.adopt.emptyDescription', {
              project: plan.data.project,
              region: plan.data.region,
            })}
            headingLevel={3}
          />
        ) : (
          <>
            <p className="text-12 text-tx-2">{t('pipelines.adopt.intro')}</p>
            {plan.data.services.map((service) => {
              const choice = current[service.service];
              return choice ? (
                <AdoptService
                  key={service.service}
                  service={service}
                  applications={plan.data.applications}
                  choice={choice}
                  onChange={(next) => choose(service.service, next)}
                />
              ) : null;
            })}
          </>
        )}
        <ActionError error={adopt.error} />
      </div>
    </Modal>
  );
}
